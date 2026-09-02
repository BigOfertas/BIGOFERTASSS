import { supabase } from "@/integrations/supabase/client";
import {
  isValidBrazilianCpf,
  isValidBrazilianPhone,
  onlyDigits,
} from "@/lib/brasil";

export type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
};

export type CustomerAddress = {
  id: string;
  label: string;
  recipient_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerAddressInput = {
  id?: string;
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

export type BrazilianPostalCodeLookup = {
  postalCode: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ViaCepResponse = {
  erro?: boolean | string;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type RpcError = {
  message: string;
};

type RpcResult<T> = Promise<{
  data: T | null;
  error: RpcError | null;
}>;

type CustomerAccountRpcClient = {
  rpc(name: "get_my_customer_identity"): RpcResult<CustomerProfile[]>;
  rpc(
    name: "update_my_customer_identity",
    args: { p_full_name: string; p_phone: string; p_cpf: string },
  ): RpcResult<CustomerProfile[]>;
  rpc(name: "list_my_customer_addresses"): RpcResult<CustomerAddress[]>;
  rpc(
    name: "save_my_customer_address",
    args: {
      p_id: string | null;
      p_label: string;
      p_recipient_name: string;
      p_postal_code: string;
      p_street: string;
      p_number: string;
      p_complement: string;
      p_neighborhood: string;
      p_city: string;
      p_state: string;
      p_is_default: boolean;
    },
  ): RpcResult<string>;
  rpc(
    name: "set_default_my_customer_address",
    args: { p_id: string },
  ): RpcResult<null>;
  rpc(
    name: "delete_my_customer_address",
    args: { p_id: string },
  ): RpcResult<null>;
};

const accountRpc = supabase as unknown as CustomerAccountRpcClient;

function throwRpcError(error: RpcError | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export async function lookupBrazilianPostalCode(
  postalCode: string,
): Promise<BrazilianPostalCodeLookup | null> {
  const normalizedPostalCode = onlyDigits(postalCode, 8);

  if (normalizedPostalCode.length !== 8) {
    throw new Error("Digite um CEP com 8 números.");
  }

  const response = await fetch(
    `https://viacep.com.br/ws/${normalizedPostalCode}/json/`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP agora.");
  }

  const data = (await response.json()) as ViaCepResponse;

  if (data.erro === true || data.erro === "true") {
    return null;
  }

  return {
    postalCode: normalizedPostalCode,
    street: data.logradouro?.trim() ?? "",
    complement: data.complemento?.trim() ?? "",
    neighborhood: data.bairro?.trim() ?? "",
    city: data.localidade?.trim() ?? "",
    state: data.uf?.trim().toUpperCase() ?? "",
  };
}

export async function fetchCustomerAccount() {
  const [profileResult, addressesResult] = await Promise.all([
    accountRpc.rpc("get_my_customer_identity"),
    accountRpc.rpc("list_my_customer_addresses"),
  ]);

  throwRpcError(profileResult.error, "Não foi possível carregar seus dados.");
  throwRpcError(
    addressesResult.error,
    "Não foi possível carregar seus endereços.",
  );

  const profile = profileResult.data?.[0];

  if (!profile) {
    throw new Error("Perfil da conta não encontrado.");
  }

  return {
    profile,
    addresses: addressesResult.data ?? [],
  };
}

export async function saveCustomerProfile(
  fullName: string,
  phone: string,
  cpf: string,
) {
  const normalizedName = fullName.trim();

  if (normalizedName.length < 2) {
    throw new Error("Informe seu nome completo.");
  }

  if (!isValidBrazilianPhone(phone)) {
    throw new Error("Informe um telefone com um DDD brasileiro válido.");
  }

  if (!isValidBrazilianCpf(cpf)) {
    throw new Error("Informe um CPF válido.");
  }

  const result = await accountRpc.rpc("update_my_customer_identity", {
    p_full_name: normalizedName,
    p_phone: onlyDigits(phone, 11),
    p_cpf: onlyDigits(cpf, 11),
  });

  throwRpcError(result.error, "Não foi possível atualizar seus dados.");

  const profile = result.data?.[0];

  if (!profile) {
    throw new Error("O perfil atualizado não foi retornado.");
  }

  return profile;
}

export async function saveCustomerAddress(input: CustomerAddressInput) {
  const result = await accountRpc.rpc("save_my_customer_address", {
    p_id: input.id ?? null,
    p_label: input.label,
    p_recipient_name: input.recipientName,
    p_postal_code: input.postalCode,
    p_street: input.street,
    p_number: input.number,
    p_complement: input.complement,
    p_neighborhood: input.neighborhood,
    p_city: input.city,
    p_state: input.state,
    p_is_default: input.isDefault,
  });

  throwRpcError(result.error, "Não foi possível salvar o endereço.");

  if (!result.data) {
    throw new Error("O endereço salvo não foi confirmado.");
  }

  return result.data;
}

export async function setDefaultCustomerAddress(id: string) {
  const result = await accountRpc.rpc("set_default_my_customer_address", {
    p_id: id,
  });

  throwRpcError(result.error, "Não foi possível definir o endereço principal.");
}

export async function deleteCustomerAddress(id: string) {
  const result = await accountRpc.rpc("delete_my_customer_address", {
    p_id: id,
  });

  throwRpcError(result.error, "Não foi possível excluir o endereço.");
}
