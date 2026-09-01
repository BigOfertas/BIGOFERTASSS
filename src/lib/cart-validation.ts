import { supabase } from "@/integrations/supabase/client";
import {
  cartItemsToValidationPayload,
  parseCartValidationRows,
  type CartItem,
  type CartValidationRow,
} from "@/lib/cart";

export async function validateCartItems(
  items: CartItem[],
): Promise<CartValidationRow[]> {
  if (items.length === 0) return [];

  const rows: CartValidationRow[] = [];

  for (let offset = 0; offset < items.length; offset += 100) {
    const batch = items.slice(offset, offset + 100);
    const { data, error } = await supabase.rpc("validate_cart_items", {
      p_items: cartItemsToValidationPayload(batch),
    });

    if (error) throw error;
    rows.push(...parseCartValidationRows(data));
  }

  return rows;
}
