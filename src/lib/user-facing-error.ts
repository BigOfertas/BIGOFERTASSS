const CPF_EM_USO =
  "Este CPF já está vinculado a outra conta. Confira o número informado. Se o CPF for seu, entre na conta já cadastrada ou use “Esqueci minha senha”.";

const CNPJ_EM_USO =
  "Este CNPJ já está vinculado a outra conta. Confira o número informado. Se o CNPJ for seu, entre na conta já cadastrada ou use “Esqueci minha senha”.";

const EMAIL_EM_USO =
  "Já existe uma conta com este e-mail. Entre na sua conta ou use “Esqueci minha senha”.";

function readMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>)["message"];
    if (typeof message === "string") return message.trim();
  }
  return "";
}

export function getUserFacingError(error: unknown, fallback: string) {
  const raw = readMessage(error);
  if (!raw) return fallback;

  const normalized = raw.toLowerCase();

  if (
    normalized.includes("profiles_cpf_unique") ||
    (normalized.includes("cpf") &&
      (normalized.includes("duplicate key") || normalized.includes("unique constraint")))
  ) {
    return CPF_EM_USO;
  }

  if (
    normalized.includes("profiles_cnpj_unique") ||
    (normalized.includes("cnpj") &&
      (normalized.includes("duplicate key") || normalized.includes("unique constraint")))
  ) {
    return CNPJ_EM_USO;
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("email already registered") ||
    normalized.includes("email address already")
  ) {
    return EMAIL_EM_USO;
  }

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Foram feitas muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  if (
    normalized.includes("session expired") ||
    normalized.includes("jwt expired") ||
    normalized.includes("invalid jwt")
  ) {
    return "Sua sessão expirou. Entre novamente.";
  }

  const technicalSignals = [
    "duplicate key",
    "constraint",
    "violates",
    "sqlstate",
    "postgres",
    "postgrest",
    "supabase",
    "pgrst",
    "permission denied",
    "row-level security",
    "invalid input syntax",
    "relation ",
    "column ",
    "function public.",
    "schema ",
    "failed to fetch",
    "networkerror",
    "typeerror",
    "referenceerror",
    "syntaxerror",
    "stack trace",
  ];

  if (technicalSignals.some((signal) => normalized.includes(signal))) {
    return fallback;
  }

  const englishTechnicalMessage =
    /\b(error|failed|invalid|unable|unexpected|not found|already exists|must be|should be|timeout|unauthorized|forbidden)\b/i;

  if (englishTechnicalMessage.test(raw)) return fallback;

  return raw;
}
