import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, oldValue, newValue) {
  const text = readFileSync(path, "utf8");
  const first = text.indexOf(oldValue);
  const last = text.lastIndexOf(oldValue);
  if (first < 0 || first !== last) {
    throw new Error(`${path}: expected exactly one match for:\n${oldValue}`);
  }
  writeFileSync(path, text.replace(oldValue, newValue));
}

const edge = "supabase/functions/auth-email-2fa/index.ts";
replaceOnce(
  edge,
  'import { consumeRateLimit, verifyTurnstile } from "../_shared/security.ts";',
  'import { consumeRateLimit } from "../_shared/security.ts";',
);
replaceOnce(
  edge,
  'async function passwordGrant(email: string, password: string): Promise<SupabasePasswordGrant> {',
  `async function passwordGrant(
  email: string,
  password: string,
  captchaToken: string,
): Promise<SupabasePasswordGrant> {`,
);
replaceOnce(
  edge,
  '      body: JSON.stringify({ email, password }),',
  `      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: { captcha_token: captchaToken },
      }),`,
);
replaceOnce(
  edge,
  `    if (source.includes("email_not_confirmed") || source.includes("email not confirmed")) {
      throw new EmailTwoFactorError(
        "Confirme seu e-mail antes de entrar. Use o link enviado pela DropBox.",
        403,
        "EMAIL_NOT_CONFIRMED",
      );
    }

    throw new EmailTwoFactorError("E-mail ou senha incorretos.", 401, "INVALID_LOGIN_CREDENTIALS");`,
  `    if (source.includes("email_not_confirmed") || source.includes("email not confirmed")) {
      throw new EmailTwoFactorError(
        "Confirme seu e-mail antes de entrar. Use o link enviado pela DropBox.",
        403,
        "EMAIL_NOT_CONFIRMED",
      );
    }

    if (source.includes("captcha")) {
      throw new EmailTwoFactorError(
        "A verificação de segurança expirou ou não foi aceita. Faça a verificação novamente.",
        403,
        "EMAIL_2FA_CAPTCHA_REJECTED",
      );
    }

    if (source.includes("api key") || source.includes("apikey") || source.includes("invalid jwt")) {
      throw new EmailTwoFactorError(
        "O acesso à conta está temporariamente indisponível.",
        503,
        "EMAIL_2FA_AUTH_CONFIGURATION_ERROR",
      );
    }

    throw new EmailTwoFactorError("E-mail ou senha incorretos.", 401, "INVALID_LOGIN_CREDENTIALS");`,
);
replaceOnce(
  edge,
  `  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  if (!email || !password) {
    throw new EmailTwoFactorError("Informe e-mail e senha.", 400, "EMAIL_2FA_LOGIN_INPUT_INVALID");
  }

  const grant = await passwordGrant(email, password);`,
  `  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  const captchaToken = typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (!email || !password) {
    throw new EmailTwoFactorError("Informe e-mail e senha.", 400, "EMAIL_2FA_LOGIN_INPUT_INVALID");
  }

  const grant = await passwordGrant(email, password, captchaToken);`,
);
replaceOnce(
  edge,
  `  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";`,
  `  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  const captchaToken = typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";`,
);
replaceOnce(
  edge,
  `  const grant = await passwordGrant(email, password);
  if (grant.user.id !== challenge.user_id) {`,
  `  const grant = await passwordGrant(email, password, captchaToken);
  if (grant.user.id !== challenge.user_id) {`,
);
replaceOnce(
  edge,
  `
      const turnstile = await verifyTurnstile(request, body.turnstileToken, "login");
      if (!turnstile.success) {
        throw new EmailTwoFactorError(
          "Não foi possível confirmar a verificação de segurança. Atualize a página e tente novamente.",
          403,
          "EMAIL_2FA_TURNSTILE_REJECTED",
        );
      }
`,
  "\n",
);

const auth = "src/lib/auth.tsx";
replaceOnce(
  auth,
  `  verifySignInTwoFactor: (
    email: string,
    password: string,
    challengeId: string,
    code: string,
  ) => Promise<AuthActionResult>;`,
  `  verifySignInTwoFactor: (
    email: string,
    password: string,
    challengeId: string,
    code: string,
    turnstileToken?: string | null,
  ) => Promise<AuthActionResult>;`,
);
replaceOnce(
  auth,
  `  async function verifySignInTwoFactor(
    email: string,
    password: string,
    challengeId: string,
    code: string,
  ): Promise<AuthActionResult> {`,
  `  async function verifySignInTwoFactor(
    email: string,
    password: string,
    challengeId: string,
    code: string,
    turnstileToken?: string | null,
  ): Promise<AuthActionResult> {`,
);
replaceOnce(
  auth,
  `        body: {
          email: email.trim(),
          password,
          challengeId,
          code: code.trim(),
        },`,
  `        body: {
          email: email.trim(),
          password,
          challengeId,
          code: code.trim(),
          ...(turnstileToken ? { turnstileToken } : {}),
        },`,
);

const login = "src/routes/login.tsx";
replaceOnce(
  login,
  `    } else if (result.requiresTwoFactor) {
      setChallengeId(result.challengeId ?? "");
      setMaskedEmail(result.maskedEmail ?? email.trim());
      setChallengeExpiresAt(result.expiresAt ?? "");
      setSecurityCode("");
    }`,
  `    } else if (result.requiresTwoFactor) {
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      setChallengeId(result.challengeId ?? "");
      setMaskedEmail(result.maskedEmail ?? email.trim());
      setChallengeExpiresAt(result.expiresAt ?? "");
      setSecurityCode("");
    }`,
);
replaceOnce(
  login,
  `    if (verifyingCode || !challengeId) return;

    const normalizedCode = securityCode.replace(/\\D/g, "").slice(0, 6);`,
  `    if (verifyingCode || !challengeId) return;
    if (turnstileRequired && !turnstileToken) {
      setErrorMessage("Conclua a verificação de segurança para continuar.");
      return;
    }

    const normalizedCode = securityCode.replace(/\\D/g, "").slice(0, 6);`,
);
replaceOnce(
  login,
  `      challengeId,
      normalizedCode,
    );

    if (error) setErrorMessage(error.message);`,
  `      challengeId,
      normalizedCode,
      turnstileToken,
    );

    if (error) {
      setErrorMessage(error.message);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }`,
);
replaceOnce(
  login,
  `    setSecurityCode("");
    setErrorMessage("");
  }`,
  `    setSecurityCode("");
    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    setErrorMessage("");
  }`,
);
replaceOnce(
  login,
  `          <p className="mt-2 text-xs leading-5 text-gray-400">
            {expiresLabel
              ? \`Este código expira por volta de \${expiresLabel}.\`
              : "O código expira em 10 minutos."}
          </p>

          {errorMessage ? (`,
  `          <p className="mt-2 text-xs leading-5 text-gray-400">
            {expiresLabel
              ? \`Este código expira por volta de \${expiresLabel}.\`
              : "O código expira em 10 minutos."}
          </p>

          <div className="mt-4">
            <TurnstileWidget
              action="login"
              onTokenChange={setTurnstileToken}
              resetKey={turnstileResetKey}
            />
          </div>

          {errorMessage ? (`,
);
replaceOnce(
  login,
  '            disabled={verifyingCode || securityCode.length !== 6}',
  `            disabled={
              verifyingCode ||
              securityCode.length !== 6 ||
              (turnstileRequired && !turnstileToken)
            }`,
);

console.log("Auth CAPTCHA login patch applied.");
