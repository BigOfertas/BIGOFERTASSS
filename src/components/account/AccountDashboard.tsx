import {
  CheckCircle2,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  deleteCustomerAddress,
  fetchCustomerAccount,
  saveCustomerAddress,
  saveCustomerProfile,
  setDefaultCustomerAddress,
  type CustomerAddress,
  type CustomerAddressInput,
  type CustomerProfile,
} from "@/lib/customer-account";

export type AccountSection = "dados" | "enderecos" | "pedidos";

type AccountDashboardProps = {
  email: string;
  section: AccountSection;
  onSectionChange: (section: AccountSection) => void;
  onSignOut: () => Promise<void>;
};

type AddressFormState = {
  id: string;
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

const EMPTY_ADDRESS_FORM: AddressFormState = {
  id: "",
  label: "Casa",
  recipientName: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  isDefault: false,
};

const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(value: string) {
  const digits = digitsOnly(value, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function addressToForm(address: CustomerAddress): AddressFormState {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipient_name,
    postalCode: formatPostalCode(address.postal_code),
    street: address.street,
    number: address.number,
    complement: address.complement ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    isDefault: address.is_default,
  };
}

function fieldClassName() {
  return "mt-1.5 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10";
}

export function AccountDashboard({
  email,
  section,
  onSectionChange,
  onSignOut,
}: AccountDashboardProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressForm, setAddressForm] = useState<AddressFormState>(
    EMPTY_ADDRESS_FORM,
  );
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const snapshot = await fetchCustomerAccount();
      setProfile(snapshot.profile);
      setAddresses(snapshot.addresses);
      setFullName(snapshot.profile.full_name ?? "");
      setPhone(formatPhone(snapshot.profile.phone ?? ""));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar sua conta.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  function updateAddressField<K extends keyof AddressFormState>(
    key: K,
    value: AddressFormState[K],
  ) {
    setAddressForm((current) => ({ ...current, [key]: value }));
  }

  function startNewAddress() {
    setAddressForm({
      ...EMPTY_ADDRESS_FORM,
      recipientName: fullName,
      isDefault: addresses.length === 0,
    });
    setShowAddressForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function startEditingAddress(address: CustomerAddress) {
    setAddressForm(addressToForm(address));
    setShowAddressForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeAddressForm() {
    setAddressForm(EMPTY_ADDRESS_FORM);
    setShowAddressForm(false);
    setErrorMessage("");
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    setSavingProfile(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updated = await saveCustomerProfile(fullName, phone);
      setProfile(updated);
      setFullName(updated.full_name ?? "");
      setPhone(formatPhone(updated.phone ?? ""));
      setSuccessMessage("Seus dados foram atualizados.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar seus dados.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingAddress) return;

    setSavingAddress(true);
    setErrorMessage("");
    setSuccessMessage("");

    const input: CustomerAddressInput = {
      id: addressForm.id || undefined,
      label: addressForm.label,
      recipientName: addressForm.recipientName,
      postalCode: addressForm.postalCode,
      street: addressForm.street,
      number: addressForm.number,
      complement: addressForm.complement,
      neighborhood: addressForm.neighborhood,
      city: addressForm.city,
      state: addressForm.state,
      isDefault: addressForm.isDefault,
    };

    try {
      await saveCustomerAddress(input);
      await loadAccount();
      setShowAddressForm(false);
      setAddressForm(EMPTY_ADDRESS_FORM);
      setSuccessMessage(
        input.id ? "Endereço atualizado." : "Endereço adicionado.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o endereço.",
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSetDefault(address: CustomerAddress) {
    if (address.is_default || busyAddressId) return;

    setBusyAddressId(address.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setDefaultCustomerAddress(address.id);
      await loadAccount();
      setSuccessMessage("Endereço principal atualizado.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o endereço principal.",
      );
    } finally {
      setBusyAddressId("");
    }
  }

  async function handleDeleteAddress(address: CustomerAddress) {
    if (busyAddressId) return;

    const confirmed = window.confirm(
      `Excluir o endereço “${address.label}”?`,
    );

    if (!confirmed) return;

    setBusyAddressId(address.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteCustomerAddress(address.id);
      await loadAccount();
      setSuccessMessage("Endereço excluído.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o endereço.",
      );
    } finally {
      setBusyAddressId("");
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setErrorMessage("");

    try {
      await onSignOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível sair da conta.",
      );
      setSigningOut(false);
    }
  }

  const navItems: Array<{
    key: AccountSection;
    label: string;
    icon: typeof UserRound;
    badge?: string;
  }> = [
    { key: "dados", label: "Minha conta", icon: UserRound },
    { key: "enderecos", label: "Endereços", icon: MapPin },
    { key: "pedidos", label: "Histórico de pedidos", icon: Package, badge: "Em breve" },
  ];

  return (
    <div className="bg-[#f7f7f7] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>Início</span>
          <span>/</span>
          <span className="font-medium text-gray-900">Minha conta</span>
        </div>

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
            Área do cliente
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
            Minha conta
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie seus dados e endereços de entrega em um só lugar.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Conta conectada
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {profile?.full_name || email}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-500">{email}</p>
            </div>

            <nav className="p-2" aria-label="Navegação da conta">
              {navItems.map(({ key, label, icon: Icon, badge }) => {
                const active = section === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSectionChange(key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
                      active
                        ? "bg-red-50 text-red-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {badge ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
                {signingOut ? "Saindo..." : "Sair da conta"}
              </button>
            </div>
          </aside>

          <section className="min-w-0">
            {errorMessage ? (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div
                role="status"
                className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="text-center text-gray-500">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                  <p className="mt-3 text-sm">Carregando seus dados...</p>
                </div>
              </div>
            ) : null}

            {!loading && section === "dados" ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-xl font-bold text-gray-950">Dados pessoais</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Mantenha suas informações de contato atualizadas.
                  </p>
                </div>

                <form onSubmit={(event) => void handleSaveProfile(event)} className="p-5 sm:p-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-gray-800">
                      Nome completo
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className={fieldClassName()}
                        autoComplete="name"
                        maxLength={120}
                        placeholder="Seu nome completo"
                      />
                    </label>

                    <label className="text-sm font-semibold text-gray-800">
                      Telefone
                      <input
                        value={phone}
                        onChange={(event) => setPhone(formatPhone(event.target.value))}
                        className={fieldClassName()}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(84) 99999-9999"
                      />
                    </label>

                    <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                      E-mail
                      <input
                        value={profile?.email ?? email}
                        readOnly
                        className={`${fieldClassName()} cursor-not-allowed bg-gray-50 text-gray-500`}
                        autoComplete="email"
                      />
                      <span className="mt-1.5 block text-xs font-normal text-gray-400">
                        O e-mail está vinculado ao seu acesso.
                      </span>
                    </label>
                  </div>

                  <div className="mt-6 border-t border-gray-100 pt-5">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="inline-flex h-11 items-center justify-center rounded-md bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar dados"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {!loading && section === "enderecos" ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-950">Endereços</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Cadastre os locais que poderão ser usados nas entregas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startNewAddress}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Novo endereço
                    </button>
                  </div>

                  {addresses.length === 0 && !showAddressForm ? (
                    <div className="px-5 py-12 text-center sm:px-6">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 font-bold text-gray-900">
                        Nenhum endereço cadastrado
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        Adicione seu primeiro endereço para deixá-lo pronto para as próximas compras.
                      </p>
                    </div>
                  ) : null}

                  {addresses.length > 0 ? (
                    <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-2">
                      {addresses.map((address) => (
                        <article
                          key={address.id}
                          className={`rounded-lg border p-4 ${
                            address.is_default
                              ? "border-red-200 bg-red-50/40"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-gray-950">{address.label}</h3>
                                {address.is_default ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                                    <Star className="h-3 w-3 fill-current" />
                                    Principal
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm font-medium text-gray-800">
                                {address.recipient_name}
                              </p>
                            </div>

                            {busyAddressId === address.id ? (
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            ) : null}
                          </div>

                          <address className="mt-3 not-italic text-sm leading-6 text-gray-600">
                            <p>
                              {address.street}, {address.number}
                              {address.complement ? ` — ${address.complement}` : ""}
                            </p>
                            <p>{address.neighborhood}</p>
                            <p>
                              {address.city} — {address.state}
                            </p>
                            <p>CEP {formatPostalCode(address.postal_code)}</p>
                          </address>

                          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200/80 pt-3">
                            <button
                              type="button"
                              onClick={() => startEditingAddress(address)}
                              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </button>

                            {!address.is_default ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAddressId)}
                                onClick={() => void handleSetDefault(address)}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                              >
                                <Star className="mr-1.5 h-3.5 w-3.5" />
                                Tornar principal
                              </button>
                            ) : null}

                            <button
                              type="button"
                              disabled={Boolean(busyAddressId)}
                              onClick={() => void handleDeleteAddress(address)}
                              className="inline-flex items-center rounded-md px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>

                {showAddressForm ? (
                  <form
                    onSubmit={(event) => void handleSaveAddress(event)}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                      <h3 className="text-lg font-bold text-gray-950">
                        {addressForm.id ? "Editar endereço" : "Novo endereço"}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Preencha os dados exatamente como devem ser usados na entrega.
                      </p>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-gray-800">
                          Identificação
                          <input
                            required
                            value={addressForm.label}
                            onChange={(event) => updateAddressField("label", event.target.value)}
                            className={fieldClassName()}
                            maxLength={40}
                            placeholder="Casa, Trabalho..."
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Destinatário
                          <input
                            required
                            value={addressForm.recipientName}
                            onChange={(event) => updateAddressField("recipientName", event.target.value)}
                            className={fieldClassName()}
                            maxLength={120}
                            autoComplete="name"
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          CEP
                          <input
                            required
                            value={addressForm.postalCode}
                            onChange={(event) =>
                              updateAddressField("postalCode", formatPostalCode(event.target.value))
                            }
                            className={fieldClassName()}
                            inputMode="numeric"
                            autoComplete="postal-code"
                            placeholder="00000-000"
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Estado
                          <select
                            required
                            value={addressForm.state}
                            onChange={(event) => updateAddressField("state", event.target.value)}
                            className={fieldClassName()}
                            autoComplete="address-level1"
                          >
                            <option value="">Selecione</option>
                            {BRAZIL_STATES.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm font-semibold text-gray-800 sm:col-span-2">
                          Rua / Avenida
                          <input
                            required
                            value={addressForm.street}
                            onChange={(event) => updateAddressField("street", event.target.value)}
                            className={fieldClassName()}
                            autoComplete="address-line1"
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Número
                          <input
                            required
                            value={addressForm.number}
                            onChange={(event) => updateAddressField("number", event.target.value)}
                            className={fieldClassName()}
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Complemento
                          <input
                            value={addressForm.complement}
                            onChange={(event) => updateAddressField("complement", event.target.value)}
                            className={fieldClassName()}
                            placeholder="Apto, bloco, referência..."
                            autoComplete="address-line2"
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Bairro
                          <input
                            required
                            value={addressForm.neighborhood}
                            onChange={(event) => updateAddressField("neighborhood", event.target.value)}
                            className={fieldClassName()}
                            autoComplete="address-level3"
                          />
                        </label>

                        <label className="text-sm font-semibold text-gray-800">
                          Cidade
                          <input
                            required
                            value={addressForm.city}
                            onChange={(event) => updateAddressField("city", event.target.value)}
                            className={fieldClassName()}
                            autoComplete="address-level2"
                          />
                        </label>
                      </div>

                      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <input
                          type="checkbox"
                          checked={addressForm.isDefault}
                          disabled={Boolean(addressForm.id && addressForm.isDefault)}
                          onChange={(event) => updateAddressField("isDefault", event.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-red-600"
                        />
                        <span>
                          <span className="block text-sm font-bold text-gray-900">
                            Usar como endereço principal
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                            O endereço principal será priorizado nas etapas de entrega.
                          </span>
                        </span>
                      </label>

                      <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-5">
                        <button
                          type="submit"
                          disabled={savingAddress}
                          className="inline-flex h-11 items-center justify-center rounded-md bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingAddress ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : addressForm.id ? (
                            "Salvar alterações"
                          ) : (
                            "Adicionar endereço"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={closeAddressForm}
                          className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}

            {!loading && section === "pedidos" ? (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm sm:px-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Package className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-bold text-gray-950">
                  Histórico de pedidos
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-500">
                  Esta área já está reservada na navegação da conta. O histórico será ativado quando a estrutura real de pedidos e checkout estiver concluída.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
