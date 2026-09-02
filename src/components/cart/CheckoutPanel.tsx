import { Link } from "@tanstack/react-router";
import { CreditCard, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/cart";
import { startInfinitePayCheckout } from "@/lib/checkout";
import {
  fetchCustomerAccount,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer-account";
import { useAuth } from "@/lib/auth";
import type { ShippingQuote } from "@/lib/shipping";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPostalCode(value: string) {
  const normalized = digits(value).slice(0, 8);
  return normalized.length === 8
    ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
    : value;
}

function hasCompleteProfile(profile: CustomerProfile | null) {
  return Boolean(
    profile?.full_name?.trim() &&
      profile.email?.trim() &&
      profile.phone?.trim() &&
      profile.cpf?.trim(),
  );
}

export function CheckoutPanel({
  cart,
  selectedShipping,
  quotedPostalCode,
  hasBlockingIssues,
}: {
  cart: CartItem[];
  selectedShipping: ShippingQuote | null;
  quotedPostalCode: string | null;
  hasBlockingIssues: boolean;
}) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const cartSignature = useMemo(
    () =>
      cart
        .map((item) => `${item.lineId}:${item.quantity}`)
        .sort()
        .join("|"),
    [cart],
  );

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const addressMatchesQuote = Boolean(
    selectedAddress &&
      quotedPostalCode &&
      digits(selectedAddress.postal_code) === digits(quotedPostalCode),
  );

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
    setCheckoutError("");
  }, [cartSignature, selectedAddressId, selectedShipping?.serviceId]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setProfile(null);
      setAddresses([]);
      setSelectedAddressId("");
      setAccountError("");
      return () => {
        active = false;
      };
    }

    setAccountLoading(true);
    setAccountError("");

    void fetchCustomerAccount()
      .then((account) => {
        if (!active) return;
        setProfile(account.profile);
        setAddresses(account.addresses);
        const defaultAddress =
          account.addresses.find((address) => address.is_default) ??
          account.addresses[0] ??
          null;
        setSelectedAddressId(defaultAddress?.id ?? "");
      })
      .catch(() => {
        if (!active) return;
        setAccountError("Não foi possível carregar seus dados de entrega.");
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleCheckout() {
    if (
      !selectedAddress ||
      !selectedShipping ||
      !addressMatchesQuote ||
      hasBlockingIssues ||
      isStartingCheckout
    ) {
      return;
    }

    setCheckoutError("");
    setIsStartingCheckout(true);

    try {
      const result = await startInfinitePayCheckout({
        addressId: selectedAddress.id,
        shippingServiceId: selectedShipping.serviceId,
        idempotencyKey,
        cart,
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o pagamento agora.",
      );
    } finally {
      setIsStartingCheckout(false);
    }
  }

  if (authLoading) {
    return (
      <Button type="button" disabled className="w-full py-6 text-lg font-bold">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
        Carregando
      </Button>
    );
  }

  if (!user) {
    return (
      <div className="space-y-2">
        <Button asChild className="w-full bg-red-600 py-6 text-lg font-bold text-white hover:bg-red-700">
          <Link to="/login">Entrar para finalizar</Link>
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-gray-500">
          A compra é vinculada à sua conta para você acompanhar o pedido.
        </p>
      </div>
    );
  }

  if (accountLoading) {
    return (
      <Button type="button" disabled className="w-full py-6 text-lg font-bold">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
        Carregando endereço
      </Button>
    );
  }

  if (accountError) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          {accountError}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/conta" search={{ secao: "enderecos" }}>
            Abrir minha conta
          </Link>
        </Button>
      </div>
    );
  }

  if (!hasCompleteProfile(profile)) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          Complete seus dados pessoais antes de finalizar a compra.
        </p>
        <Button asChild className="w-full bg-red-600 text-white hover:bg-red-700">
          <Link to="/conta" search={{ secao: "dados" }}>
            Completar meus dados
          </Link>
        </Button>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          Cadastre um endereço de entrega para continuar.
        </p>
        <Button asChild className="w-full bg-red-600 text-white hover:bg-red-700">
          <Link to="/conta" search={{ secao: "enderecos" }}>
            Cadastrar endereço
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="checkout-address-title">
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-red-600" aria-hidden="true" />
          <h3 id="checkout-address-title" className="text-xs font-bold text-gray-900">
            Endereço de entrega
          </h3>
        </div>
        <label className="sr-only" htmlFor="checkout-address">
          Selecione o endereço de entrega
        </label>
        <select
          id="checkout-address"
          value={selectedAddressId}
          onChange={(event) => setSelectedAddressId(event.target.value)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50 motion-reduce:transition-none"
        >
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.label} · {address.city}/{address.state} · {formatPostalCode(address.postal_code)}
            </option>
          ))}
        </select>
        {selectedAddress ? (
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            {selectedAddress.street}, {selectedAddress.number} · {selectedAddress.neighborhood}
          </p>
        ) : null}
      </div>

      {selectedShipping && selectedAddress && !addressMatchesQuote ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          Calcule a entrega usando o CEP {formatPostalCode(selectedAddress.postal_code)} para continuar.
        </p>
      ) : null}

      {!selectedShipping ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          Escolha uma opção de entrega antes de finalizar.
        </p>
      ) : null}

      {checkoutError ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
          {checkoutError}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={
          !selectedShipping ||
          !selectedAddress ||
          !addressMatchesQuote ||
          hasBlockingIssues ||
          isStartingCheckout
        }
        className="w-full bg-red-600 py-6 text-lg font-bold text-white transition hover:bg-red-700 motion-reduce:transition-none"
      >
        {isStartingCheckout ? (
          <>
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
            Abrindo pagamento
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" aria-hidden="true" />
            Finalizar compra
          </>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Pagamento processado pela InfinitePay.
      </p>
    </section>
  );
}
