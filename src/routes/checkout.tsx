import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gift,
  LoaderCircle,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/lib/auth";
import {
  formatBrazilianCnpj,
  formatBrazilianCpf,
  formatBrazilianPhone,
  isValidBrazilianCnpj,
  isValidBrazilianCpf,
  isValidBrazilianPhone,
  onlyDigits,
} from "@/lib/brasil";
import {
  fetchCheckoutIdentity,
  isCheckoutIdentityComplete,
  saveCheckoutIdentity,
  type CheckoutIdentity,
  type CheckoutPersonType,
} from "@/lib/checkout-account";
import { startInfinitePayCheckout } from "@/lib/checkout";
import {
  fetchCustomerAccount,
  lookupBrazilianPostalCode,
  saveCustomerAddress,
  type CustomerAddress,
  type CustomerAddressInput,
} from "@/lib/customer-account";
import { getProgressiveDiscount } from "@/lib/progressive-discount";
import {
  formatTransitLabel,
  requestShippingQuotes,
  type ShippingQuote,
} from "@/lib/shipping";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

type Step = 1 | 2 | 3 | 4;

type AddressDraft = {
  label: string;
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressDraft = {
  label: "Casa",
  recipientName: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  isDefault: true,
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPostalCode(value: string) {
  const digits = onlyDigits(value, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

const STEPS = [
  { step: 1 as const, label: "Dados pessoais", icon: UserRound },
  { step: 2 as const, label: "Endereço", icon: MapPin },
  { step: 3 as const, label: "Entrega", icon: Truck },
  { step: 4 as const, label: "Revisar", icon: CreditCard },
];

function CheckoutStepper({ current }: { current: Step }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="hidden items-center sm:flex">
        {STEPS.map(({ step, label, icon: Icon }, index) => {
          const active = current === step;
          const completed = current > step;
          return (
            <div key={step} className="contents">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-black ${
                    completed
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Etapa {step}
                  </p>
                  <p className={`truncate text-sm font-bold ${active ? "text-gray-950" : "text-gray-500"}`}>
                    {label}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 ? (
                <ChevronRight className="mx-2 h-4 w-4 flex-none text-gray-300" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              Etapa {current} de 4
            </p>
            <p className="mt-0.5 font-black text-gray-950">
              {STEPS.find((item) => item.step === current)?.label}
            </p>
          </div>
          <span className="text-sm font-black tabular-nums text-gray-400">{current}/4</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {STEPS.map(({ step }) => (
            <span
              key={step}
              className={`h-1.5 rounded-full ${step <= current ? "bg-red-600" : "bg-gray-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { cart, totalItems, totalPrice, hasBlockingIssues, validateCart } = useCart();
  const [step, setStep] = useState<Step>(1);
  const [identity, setIdentity] = useState<CheckoutIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [personType, setPersonType] = useState<CheckoutPersonType>("individual");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const [lookingUpPostalCode, setLookingUpPostalCode] = useState(false);

  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const discount = getProgressiveDiscount(totalItems, totalPrice);
  const customerShipping = discount.freeShipping ? 0 : selectedQuote?.totalPrice ?? 0;
  const finalTotal = discount.subtotalAfterDiscount + customerShipping;

  useEffect(() => {
    void validateCart();
  }, [validateCart]);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setIdentityLoading(true);
    setErrorMessage("");

    void Promise.all([fetchCheckoutIdentity(), fetchCustomerAccount()])
      .then(([nextIdentity, account]) => {
        if (!active) return;
        setIdentity(nextIdentity);
        setPersonType(nextIdentity.person_type ?? "individual");
        setFullName(nextIdentity.full_name ?? user.user_metadata?.full_name ?? "");
        setPhone(formatBrazilianPhone(nextIdentity.phone ?? ""));
        setSecondaryPhone(formatBrazilianPhone(nextIdentity.secondary_phone ?? ""));
        setCpf(formatBrazilianCpf(nextIdentity.cpf ?? ""));
        setCnpj(formatBrazilianCnpj(nextIdentity.cnpj ?? ""));
        setCompanyName(nextIdentity.company_name ?? "");
        setTradeName(nextIdentity.trade_name ?? "");
        setAddresses(account.addresses);
        const defaultAddress =
          account.addresses.find((address) => address.is_default) ?? account.addresses[0] ?? null;
        setSelectedAddressId(defaultAddress?.id ?? "");
        setShowAddressForm(account.addresses.length === 0);
        setAddressDraft((current) => ({
          ...current,
          recipientName: nextIdentity.full_name ?? user.user_metadata?.full_name ?? "",
          isDefault: account.addresses.length === 0,
        }));
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível preparar o checkout.",
        );
      })
      .finally(() => {
        if (active) setIdentityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    setQuotes([]);
    setSelectedQuote(null);
  }, [selectedAddressId]);

  const identityFormValid =
    fullName.trim().length >= 2 &&
    isValidBrazilianPhone(phone) &&
    (!secondaryPhone ||
      (isValidBrazilianPhone(secondaryPhone) &&
        onlyDigits(secondaryPhone) !== onlyDigits(phone))) &&
    (personType === "individual"
      ? isValidBrazilianCpf(cpf)
      : isValidBrazilianCnpj(cnpj) && companyName.trim().length >= 2);

  async function saveIdentityAndContinue() {
    if (!identityFormValid || savingIdentity) return;
    setSavingIdentity(true);
    setErrorMessage("");
    try {
      const updated = await saveCheckoutIdentity({
        personType,
        fullName,
        phone,
        secondaryPhone,
        cpf,
        cnpj,
        companyName,
        tradeName,
      });
      setIdentity(updated);
      setStep(2);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar seus dados.");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function lookupPostalCode() {
    const postalCode = onlyDigits(addressDraft.postalCode, 8);
    if (postalCode.length !== 8 || lookingUpPostalCode) return;
    setLookingUpPostalCode(true);
    setErrorMessage("");
    try {
      const result = await lookupBrazilianPostalCode(postalCode);
      if (!result) {
        setErrorMessage("CEP não encontrado. Confira e tente novamente.");
        return;
      }
      setAddressDraft((current) => ({
        ...current,
        postalCode: formatPostalCode(result.postalCode),
        street: result.street || current.street,
        complement: current.complement || result.complement,
        neighborhood: result.neighborhood || current.neighborhood,
        city: result.city || current.city,
        state: result.state || current.state,
      }));
    } catch {
      setErrorMessage("Não foi possível consultar o CEP agora.");
    } finally {
      setLookingUpPostalCode(false);
    }
  }

  const addressDraftValid =
    onlyDigits(addressDraft.postalCode, 8).length === 8 &&
    addressDraft.recipientName.trim().length >= 2 &&
    addressDraft.street.trim().length >= 2 &&
    addressDraft.number.trim().length > 0 &&
    addressDraft.neighborhood.trim().length >= 2 &&
    addressDraft.city.trim().length >= 2 &&
    addressDraft.state.trim().length === 2;

  async function saveAddressAndContinue() {
    if (!addressDraftValid || savingAddress) return;
    setSavingAddress(true);
    setErrorMessage("");
    const input: CustomerAddressInput = {
      label: addressDraft.label.trim() || "Entrega",
      recipientName: addressDraft.recipientName.trim(),
      postalCode: addressDraft.postalCode,
      street: addressDraft.street.trim(),
      number: addressDraft.number.trim(),
      complement: addressDraft.complement.trim(),
      neighborhood: addressDraft.neighborhood.trim(),
      city: addressDraft.city.trim(),
      state: addressDraft.state.trim().toUpperCase(),
      isDefault: addressDraft.isDefault,
    };

    try {
      const newId = await saveCustomerAddress(input);
      const account = await fetchCustomerAccount();
      setAddresses(account.addresses);
      setSelectedAddressId(newId);
      setShowAddressForm(false);
      setStep(3);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o endereço.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function continueWithSelectedAddress() {
    if (!selectedAddress) return;
    setErrorMessage("");
    setStep(3);
  }

  async function calculateDelivery() {
    if (!selectedAddress || loadingQuotes) return;
    setLoadingQuotes(true);
    setErrorMessage("");
    setQuotes([]);
    setSelectedQuote(null);
    try {
      const result = await requestShippingQuotes(selectedAddress.postal_code, cart);
      setQuotes(result.quotes);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível calcular a entrega.");
    } finally {
      setLoadingQuotes(false);
    }
  }

  useEffect(() => {
    if (step === 3 && selectedAddress && quotes.length === 0 && !loadingQuotes) {
      void calculateDelivery();
    }
    // calculation should run only when entering delivery or changing the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedAddressId]);

  async function openPayment() {
    if (!selectedAddress || !selectedQuote || checkoutLoading) return;
    setCheckoutLoading(true);
    setErrorMessage("");
    try {
      const result = await startInfinitePayCheckout({
        addressId: selectedAddress.id,
        shippingServiceId: selectedQuote.serviceId,
        idempotencyKey: idempotencyKeyRef.current,
        cart,
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível abrir o pagamento.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (authLoading || identityLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-center text-gray-500">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-red-600 motion-reduce:animate-none" />
          <p className="mt-3 text-sm">Preparando seu checkout...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  if (!user.email_confirmed_at) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-4 text-xl font-black text-gray-950">Confirme seu e-mail primeiro</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            A BIGofertas só libera a conta e o checkout depois da confirmação do endereço de e-mail.
          </p>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="max-w-md text-center">
          <PackageCheck className="mx-auto h-10 w-10 text-gray-300" />
          <h1 className="mt-4 text-xl font-black text-gray-950">Seu carrinho está vazio</h1>
          <Button asChild className="mt-5 bg-red-600 text-white hover:bg-red-700">
            <Link to="/products" search={{}}>Escolher produtos</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (hasBlockingIssues) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-xl font-black text-gray-950">Revise o carrinho</h1>
          <p className="mt-2 text-sm text-gray-600">Algum item precisa ser revisado antes de continuar.</p>
          <Button asChild className="mt-5 bg-red-600 text-white hover:bg-red-700">
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        </div>
      </main>
    );
  }

  const inputClass =
    "mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-50";

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="text-xl font-black italic tracking-tight text-gray-950">
            <span className="text-red-600">BIG</span>ofertas
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Checkout seguro
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="-ml-3 text-gray-600">
            <Link to="/cart"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao carrinho</Link>
          </Button>
          <p className="hidden text-xs text-gray-400 sm:block">Você poderá revisar tudo antes do pagamento.</p>
        </div>

        <CheckoutStepper current={step} />

        {errorMessage ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            {step === 1 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Etapa 1</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950">Dados pessoais</h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Precisamos destes dados para identificar o comprador e entrar em contato sobre o pedido.
                </p>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className="text-sm font-semibold text-gray-800">Tipo de cadastro</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPersonType("individual")}
                        className={`h-11 rounded-lg border text-sm font-bold ${personType === "individual" ? "border-red-600 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}
                      >
                        Pessoa física
                      </button>
                      <button
                        type="button"
                        onClick={() => setPersonType("business")}
                        className={`h-11 rounded-lg border text-sm font-bold ${personType === "business" ? "border-red-600 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}
                      >
                        Pessoa jurídica
                      </button>
                    </div>
                  </div>

                  <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                    Nome completo do responsável
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} autoComplete="name" />
                  </label>

                  {personType === "individual" ? (
                    <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                      CPF
                      <input value={cpf} onChange={(event) => setCpf(formatBrazilianCpf(event.target.value))} className={inputClass} inputMode="numeric" placeholder="000.000.000-00" />
                    </label>
                  ) : (
                    <>
                      <label className="text-sm font-semibold text-gray-800">
                        CNPJ
                        <input value={cnpj} onChange={(event) => setCnpj(formatBrazilianCnpj(event.target.value))} className={inputClass} inputMode="numeric" placeholder="00.000.000/0000-00" />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Razão social
                        <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                        Nome fantasia <span className="font-normal text-gray-400">(opcional)</span>
                        <input value={tradeName} onChange={(event) => setTradeName(event.target.value)} className={inputClass} />
                      </label>
                    </>
                  )}

                  <label className="text-sm font-semibold text-gray-800">
                    Telefone principal
                    <input value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} className={inputClass} inputMode="tel" autoComplete="tel" placeholder="(84) 99999-9999" />
                  </label>
                  <label className="text-sm font-semibold text-gray-800">
                    Segundo telefone <span className="font-normal text-gray-400">(opcional)</span>
                    <input value={secondaryPhone} onChange={(event) => setSecondaryPhone(formatBrazilianPhone(event.target.value))} className={inputClass} inputMode="tel" placeholder="(84) 99999-9999" />
                  </label>
                </div>

                <div className="mt-7 flex justify-end">
                  <Button onClick={() => void saveIdentityAndContinue()} disabled={!identityFormValid || savingIdentity} className="bg-red-600 text-white hover:bg-red-700">
                    {savingIdentity ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Etapa 2</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950">Endereço de entrega</h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">Escolha um endereço salvo ou cadastre o local da entrega.</p>

                {addresses.length > 0 && !showAddressForm ? (
                  <div className="mt-6 space-y-3">
                    {addresses.map((address) => {
                      const selected = address.id === selectedAddressId;
                      return (
                        <button key={address.id} type="button" onClick={() => setSelectedAddressId(address.id)} className={`w-full rounded-xl border p-4 text-left ${selected ? "border-red-500 bg-red-50/50" : "border-gray-200 bg-white"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="text-sm text-gray-950">{address.label}</strong>
                                {address.is_default ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Padrão</span> : null}
                              </div>
                              <p className="mt-1 text-sm text-gray-600">{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ""}</p>
                              <p className="mt-1 text-xs text-gray-500">{address.neighborhood} · {address.city}/{address.state} · {formatPostalCode(address.postal_code)}</p>
                            </div>
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-red-600 bg-red-600 text-white" : "border-gray-300 text-transparent"}`}><Check className="h-3.5 w-3.5" /></span>
                          </div>
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => { setAddressDraft({ ...EMPTY_ADDRESS, recipientName: fullName, isDefault: false }); setShowAddressForm(true); }} className="w-full rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm font-bold text-gray-600 hover:border-red-300 hover:text-red-700">
                      + Adicionar novo endereço
                    </button>
                    <div className="mt-6 flex items-center justify-between gap-3">
                      <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                      <Button onClick={() => void continueWithSelectedAddress()} disabled={!selectedAddress} className="bg-red-600 text-white hover:bg-red-700">Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-gray-800">
                        Nome do endereço
                        <input value={addressDraft.label} onChange={(event) => setAddressDraft((current) => ({ ...current, label: event.target.value }))} className={inputClass} placeholder="Casa, Trabalho..." />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Quem recebe
                        <input value={addressDraft.recipientName} onChange={(event) => setAddressDraft((current) => ({ ...current, recipientName: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                        CEP
                        <div className="mt-1.5 flex gap-2">
                          <input value={addressDraft.postalCode} onChange={(event) => setAddressDraft((current) => ({ ...current, postalCode: formatPostalCode(event.target.value) }))} className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" inputMode="numeric" placeholder="00000-000" />
                          <Button type="button" variant="outline" onClick={() => void lookupPostalCode()} disabled={lookingUpPostalCode || onlyDigits(addressDraft.postalCode, 8).length !== 8}>{lookingUpPostalCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Buscar CEP"}</Button>
                        </div>
                      </label>
                      <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                        Rua
                        <input value={addressDraft.street} onChange={(event) => setAddressDraft((current) => ({ ...current, street: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Número
                        <input value={addressDraft.number} onChange={(event) => setAddressDraft((current) => ({ ...current, number: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Complemento <span className="font-normal text-gray-400">(opcional)</span>
                        <input value={addressDraft.complement} onChange={(event) => setAddressDraft((current) => ({ ...current, complement: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Bairro
                        <input value={addressDraft.neighborhood} onChange={(event) => setAddressDraft((current) => ({ ...current, neighborhood: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Cidade
                        <input value={addressDraft.city} onChange={(event) => setAddressDraft((current) => ({ ...current, city: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Estado
                        <input value={addressDraft.state} onChange={(event) => setAddressDraft((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))} className={inputClass} maxLength={2} placeholder="RN" />
                      </label>
                    </div>

                    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <input type="checkbox" checked={addressDraft.isDefault} onChange={(event) => setAddressDraft((current) => ({ ...current, isDefault: event.target.checked }))} className="mt-1 h-4 w-4 accent-emerald-600" />
                      <span>
                        <strong className="block text-sm text-emerald-950">Deseja deixar este como seu endereço padrão? :)</strong>
                        <span className="mt-1 block text-xs leading-5 text-emerald-800/80">Na próxima compra ele já aparecerá selecionado para você.</span>
                      </span>
                    </label>

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <Button variant="outline" onClick={() => addresses.length > 0 ? setShowAddressForm(false) : setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                      <Button onClick={() => void saveAddressAndContinue()} disabled={!addressDraftValid || savingAddress} className="bg-red-600 text-white hover:bg-red-700">{savingAddress ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar e continuar</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Etapa 3</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950">Escolha a entrega</h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">Selecione a opção que combina melhor com seu pedido.</p>

                {discount.freeShipping ? (
                  <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><Gift className="h-5 w-5" />Seu pedido tem frete grátis.</div>
                ) : null}

                <div className="mt-6 space-y-3">
                  {loadingQuotes ? (
                    <div className="flex items-center justify-center py-14 text-gray-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Calculando opções...</div>
                  ) : quotes.length > 0 ? (
                    quotes.map((quote) => {
                      const selected = selectedQuote?.serviceId === quote.serviceId;
                      return (
                        <button key={quote.serviceId} type="button" onClick={() => setSelectedQuote(quote)} className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left ${selected ? "border-red-500 bg-red-50/50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>{selected ? <Check className="h-5 w-5" /> : <Truck className="h-5 w-5" />}</span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm text-gray-950">{quote.service}</strong><span className="mt-1 block text-xs text-gray-500">{formatTransitLabel(quote)}</span></span>
                          <strong className={discount.freeShipping ? "text-emerald-700" : "text-gray-950"}>{discount.freeShipping ? "Grátis" : currency.format(quote.totalPrice)}</strong>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">Nenhuma opção carregada.</div>
                  )}
                </div>

                <p className="mt-4 text-xs leading-5 text-gray-500">Produção em até 5 dias úteis antes do envio.</p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                  <Button onClick={() => setStep(4)} disabled={!selectedQuote} className="bg-red-600 text-white hover:bg-red-700">Revisar pedido <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">Etapa 4</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950">Revisar e pagar</h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">Confira os dados abaixo. O pagamento será feito na InfinitePay.</p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3"><strong className="text-sm text-gray-950">Comprador</strong><button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-red-600">Editar</button></div>
                    <p className="mt-2 text-sm text-gray-700">{identity?.full_name}</p>
                    <p className="mt-1 text-xs text-gray-500">{identity?.person_type === "business" ? `CNPJ ${formatBrazilianCnpj(identity.cnpj ?? "")}` : `CPF ${formatBrazilianCpf(identity?.cpf ?? "")}`} · {formatBrazilianPhone(identity?.phone ?? "")}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3"><strong className="text-sm text-gray-950">Endereço</strong><button type="button" onClick={() => setStep(2)} className="text-xs font-bold text-red-600">Editar</button></div>
                    <p className="mt-2 text-sm text-gray-700">{selectedAddress?.street}, {selectedAddress?.number}{selectedAddress?.complement ? ` · ${selectedAddress.complement}` : ""}</p>
                    <p className="mt-1 text-xs text-gray-500">{selectedAddress?.neighborhood} · {selectedAddress?.city}/{selectedAddress?.state} · {formatPostalCode(selectedAddress?.postal_code ?? "")}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3"><strong className="text-sm text-gray-950">Entrega</strong><button type="button" onClick={() => setStep(3)} className="text-xs font-bold text-red-600">Editar</button></div>
                    <p className="mt-2 text-sm text-gray-700">{selectedQuote?.service} · {selectedQuote ? formatTransitLabel(selectedQuote) : ""}</p>
                    <p className={`mt-1 text-xs font-bold ${discount.freeShipping ? "text-emerald-700" : "text-gray-500"}`}>{discount.freeShipping ? "Frete grátis" : selectedQuote ? currency.format(selectedQuote.totalPrice) : ""}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <strong className="text-sm text-gray-950">Produtos</strong>
                    <div className="mt-3 divide-y divide-gray-100">
                      {cart.map((item) => (
                        <div key={item.lineId} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.selectedOptions.map((option) => `${option.optionName}: ${option.valueLabel}`).join(" · ")} · Qtd. {item.quantity}</p></div>
                          <strong className="flex-none text-sm text-gray-900">{currency.format(item.unitPrice * item.quantity)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                  <Button onClick={() => void openPayment()} disabled={checkoutLoading || !selectedAddress || !selectedQuote || !isCheckoutIdentityComplete(identity)} className="bg-red-600 text-white hover:bg-red-700">
                    {checkoutLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Ir para pagamento
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-5">
            <h2 className="font-black text-gray-950">Resumo</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-gray-600"><span>{totalItems} {totalItems === 1 ? "peça" : "peças"}</span><span>{currency.format(totalPrice)}</span></div>
              {discount.discountAmount > 0 ? <div className="flex justify-between gap-4 font-semibold text-emerald-700"><span className="flex items-center gap-1"><BadgePercent className="h-4 w-4" />Desconto {discount.percent}%</span><span>-{currency.format(discount.discountAmount)}</span></div> : null}
              <div className="flex justify-between gap-4 text-gray-600"><span>Frete</span><span className={discount.freeShipping ? "font-bold text-emerald-700" : "font-semibold text-gray-900"}>{discount.freeShipping ? "Grátis" : selectedQuote ? currency.format(selectedQuote.totalPrice) : "A definir"}</span></div>
              <div className="border-t border-gray-100 pt-3"><div className="flex items-end justify-between gap-4"><strong className="text-gray-950">Total</strong><strong className="text-xl text-red-600">{currency.format(finalTotal)}</strong></div></div>
            </div>
            {discount.nextTier ? <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><BadgePercent className="mb-1 h-4 w-4" />Adicione mais {discount.nextTier.unitsRemaining} {discount.nextTier.unitsRemaining === 1 ? "peça" : "peças"} para chegar a {discount.nextTier.percent}% de desconto{discount.nextTier.freeShipping ? " e frete grátis" : ""}.</div> : discount.freeShipping ? <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><Gift className="h-4 w-4" />Frete grátis liberado.</div> : null}
            <div className="mt-5 flex items-start gap-2 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />Você revisará tudo antes de seguir para a InfinitePay.</div>
          </aside>
        </div>
      </main>
    </div>
  );
}
