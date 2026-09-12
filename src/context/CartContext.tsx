import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  CART_STORAGE_KEY,
  clampCartQuantity,
  createCartItem,
  createCartLineId,
  decodeStoredCart,
  encodeStoredCart,
  normalizeCartItems,
  type AddCartItemInput,
  type CartItem,
} from "@/lib/cart";
import { validateCartItems } from "@/lib/cart-validation";
import { normalizePurchaseCustomization } from "@/lib/product-purchase";

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: AddCartItemInput, quantity?: number) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  validateCart: () => Promise<void>;
  isValidating: boolean;
  validationError: string | null;
  hasBlockingIssues: boolean;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function loadStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  return decodeStoredCart(localStorage.getItem(CART_STORAGE_KEY));
}

function preserveSelectedSize(item: CartItem, customization: CartItem["customization"]) {
  const normalized = normalizePurchaseCustomization(customization);
  if (normalized.size) return normalized;

  const sizeSnapshot = item.selectedOptions.find(
    (option) => option.optionKind === "size" && option.valueLabel.trim().length > 0,
  );
  if (!sizeSnapshot) return normalized;

  return normalizePurchaseCustomization({
    ...normalized,
    size: sizeSnapshot.valueLabel,
  });
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(loadStoredCart);
  const cartRef = useRef(cart);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    cartRef.current = cart;
    localStorage.setItem(CART_STORAGE_KEY, encodeStoredCart(cart));
  }, [cart]);

  const addToCart = useCallback((input: AddCartItemInput, quantity = 1) => {
    const incoming = createCartItem(input, quantity);

    setCart((previous) => {
      const existing = previous.find((item) => item.lineId === incoming.lineId);

      if (!existing) {
        toast.success(`${input.name} adicionado ao carrinho!`);
        return [...previous, incoming];
      }

      const nextQuantity = clampCartQuantity(
        existing.quantity + incoming.quantity,
        incoming.availableStock,
      );

      if (nextQuantity < existing.quantity + incoming.quantity) {
        toast.warning("A quantidade máxima por item é 99.");
      } else {
        toast.success(`Quantidade de ${input.name} atualizada no carrinho!`);
      }

      return previous.map((item) =>
        item.lineId === incoming.lineId
          ? {
              ...incoming,
              quantity: nextQuantity,
            }
          : item,
      );
    });
  }, []);

  const removeFromCart = useCallback((lineId: string) => {
    setCart((previous) => previous.filter((item) => item.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(lineId);
        return;
      }

      setCart((previous) =>
        normalizeCartItems(
          previous.map((item) => {
            if (item.lineId !== lineId) return item;

            const nextQuantity = clampCartQuantity(quantity, item.availableStock);

            if (nextQuantity < quantity) {
              toast.warning("A quantidade máxima por item é 99.");
            }

            return { ...item, quantity: nextQuantity };
          }),
        ),
      );
    },
    [removeFromCart],
  );

  const clearCart = useCallback(() => setCart([]), []);

  const validateCart = useCallback(async () => {
    const currentCart = cartRef.current;

    if (currentCart.length === 0) {
      setValidationError(null);
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const validation = await validateCartItems(currentCart);
      const byLine = new Map(validation.map((row) => [row.line_id, row]));
      let adjustedQuantities = false;

      setCart((previous) =>
        normalizeCartItems(
          previous.map((item) => {
            const result = byLine.get(item.lineId);

            if (!result) {
              return { ...item, status: "unavailable" as const };
            }

            const availableStock = result.available_stock;
            const quantity = clampCartQuantity(item.quantity, availableStock);
            if (quantity !== item.quantity) adjustedQuantities = true;

            const resolvedVariantId =
              result.status === "needs_review"
                ? item.variantId
                : (result.variant_id ?? item.variantId);
            const resolvedCustomization = preserveSelectedSize(item, result.customization);

            return {
              ...item,
              lineId: createCartLineId(item.productId, resolvedVariantId, resolvedCustomization),
              productSlug: result.product_slug ?? item.productSlug,
              variantId: resolvedVariantId,
              sku: result.variant_sku ?? item.sku,
              name: result.product_name ?? item.name,
              variantName: result.variant_name ?? item.variantName,
              unitPrice: result.unit_price ?? item.unitPrice,
              availableStock,
              customization: resolvedCustomization,
              quantity,
              status: result.status,
            };
          }),
        ),
      );

      if (adjustedQuantities) {
        toast.warning("Algumas quantidades foram ajustadas ao limite por item.");
      }
    } catch {
      setValidationError(
        "Não foi possível atualizar o carrinho agora. Tente novamente em instantes.",
      );
    } finally {
      setIsValidating(false);
    }
  }, []);

  const totalItems = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);
  const totalPrice = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const hasBlockingIssues = useMemo(
    () => cart.some((item) => item.status !== "available" || item.variantId === null),
    [cart],
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        validateCart,
        isValidating,
        validationError,
        hasBlockingIssues,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
};
