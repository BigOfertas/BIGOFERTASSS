import { supabase } from "@/integrations/supabase/client";
import {
  isValidBrazilianCnpj,
  isValidBrazilianCpf,
  isValidBrazilianPhone,
  onlyDigits,
} from "@/lib/brasil";
import { getUserFacingError } from "@/lib/user-facing-error";

export type CheckoutPersonType = "individual" | "business";

export type CheckoutIdentity = {
  id: string;
  email: string | null;
  full_name: string | null;
  person_type: CheckoutPersonType | null;
  phone: string | null;
  secondary_phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company_name: string | null;
  trade_name: string | null;
};

export type CheckoutIdentityInput = {
  personType: CheckoutPersonType;
  fullName: string;
  phone: string;
  secondaryPhone: string;
  cpf: string;
  cnpj: string;
  companyName: string;
  tradeName: string;
};

type RpcError = { message: string };
type RpcResult<T> = Promise<{ data: T | null; error: RpcError | null }>;

type CheckoutIdentityRpc = {
  rpc(name: "get_my_checkout_identity"): RpcResult<CheckoutIdentity[]>;
  rpc(
    name: "update_my_checkout_identity",
    args: {
      p_person_type: CheckoutPersonType;
      p_full_name: string;
      p_phone: string;
      p_secondary_phone: string | null;
      p_cpf: string | null;
      p_cnpj: string | null;
      p_company_name: string | null;
      p_trade_name: string | null;
    },
  ): RpcResult<CheckoutIdentity[]>;
};

const checkoutIdentityRpc = supabase as unknown as CheckoutIdentityRpc;

export function isCheckoutIdentityComplete(identity: CheckoutIdentity | null) {
  if (!identity?.full_name?.trim() || !isValidBrazilianPhone(identity.phone ?? "")) {
    return false;
  }

  if (identity.person_type === "individual") {
    return isValidBrazilianCpf(identity.cpf ?? "");
  }

  if (identity.person_type === "business") {
    return isValidBrazilianCnpj(identity.cnpj ?? "") && Boolean(identity.company_name?.trim());
  }

  return false;
}

export async function fetchCheckoutIdentity() {
  const { data, error } = await checkoutIdentityRpc.rpc("get_my_checkout_identity");
  if (error) {
    throw new Error(getUserFacingError(error, "Não foi possível carregar seus dados."));
  }

  const identity = data?.[0];
  if (!identity) throw new Error("Não foi possível localizar os dados da sua conta.");
  return identity;
}

export async function saveCheckoutIdentity(input: CheckoutIdentityInput) {
  const fullName = input.fullName.trim();
  const phone = onlyDigits(input.phone, 11);
  const secondaryPhone = onlyDigits(input.secondaryPhone, 11);
  const cpf = onlyDigits(input.cpf, 11);
  const cnpj = onlyDigits(input.cnpj, 14);
  const companyName = input.companyName.trim();
  const tradeName = input.tradeName.trim();

  if (fullName.length < 2) throw new Error("Informe seu nome completo.");
  if (!isValidBrazilianPhone(phone)) {
    throw new Error("Informe um telefone principal com DDD válido.");
  }
  if (secondaryPhone) {
    if (!isValidBrazilianPhone(secondaryPhone)) {
      throw new Error("Confira o telefone secundário.");
    }
    if (secondaryPhone === phone) {
      throw new Error("O telefone secundário deve ser diferente do principal.");
    }
  }

  if (input.personType === "individual" && !isValidBrazilianCpf(cpf)) {
    throw new Error("Informe um CPF válido.");
  }

  if (input.personType === "business") {
    if (!isValidBrazilianCnpj(cnpj)) throw new Error("Informe um CNPJ válido.");
    if (companyName.length < 2) throw new Error("Informe a razão social.");
  }

  const { data, error } = await checkoutIdentityRpc.rpc("update_my_checkout_identity", {
    p_person_type: input.personType,
    p_full_name: fullName,
    p_phone: phone,
    p_secondary_phone: secondaryPhone || null,
    p_cpf: input.personType === "individual" ? cpf : null,
    p_cnpj: input.personType === "business" ? cnpj : null,
    p_company_name: input.personType === "business" ? companyName : null,
    p_trade_name: input.personType === "business" && tradeName ? tradeName : null,
  });

  if (error) {
    throw new Error(getUserFacingError(error, "Não foi possível salvar seus dados."));
  }
  const identity = data?.[0];
  if (!identity) throw new Error("Não foi possível confirmar os dados salvos.");
  return identity;
}
