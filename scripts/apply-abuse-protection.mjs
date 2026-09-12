import fs from "node:fs";

function patchFile(path, replacements) {
  let content = fs.readFileSync(path, "utf8");
  for (const [before, after, label] of replacements) {
    const occurrences = content.split(before).length - 1;
    if (occurrences !== 1) {
      throw new Error(`${path}: expected exactly one match for ${label}, found ${occurrences}`);
    }
    content = content.replace(before, after);
  }
  fs.writeFileSync(path, content);
}

patchFile("src/lib/auth.tsx", [
  [
    '  signIn: (email: string, password: string) => Promise<SignInResult>;',
    '  signIn: (email: string, password: string, turnstileToken?: string | null) => Promise<SignInResult>;',
    "auth signIn type",
  ],
  [
    '    referralCode?: string | null,\n  ) => Promise<AuthActionResult>;',
    '    referralCode?: string | null,\n    captchaToken?: string | null,\n  ) => Promise<AuthActionResult>;',
    "auth signUp type",
  ],
  [
    '  async function signIn(email: string, password: string): Promise<SignInResult> {',
    '  async function signIn(\n    email: string,\n    password: string,\n    turnstileToken?: string | null,\n  ): Promise<SignInResult> {',
    "auth signIn implementation",
  ],
  [
    '        body: { email: email.trim(), password },',
    '        body: {\n          email: email.trim(),\n          password,\n          ...(turnstileToken ? { turnstileToken } : {}),\n        },',
    "auth login token forwarding",
  ],
  [
    '    referralCode?: string | null,\n  ): Promise<AuthActionResult> {',
    '    referralCode?: string | null,\n    captchaToken?: string | null,\n  ): Promise<AuthActionResult> {',
    "auth signUp implementation",
  ],
  [
    '      options: {\n        ...(emailRedirectTo ? { emailRedirectTo } : {}),',
    '      options: {\n        ...(emailRedirectTo ? { emailRedirectTo } : {}),\n        ...(captchaToken ? { captchaToken } : {}),',
    "auth signup captcha option",
  ],
]);

patchFile("src/routes/login.tsx", [
  [
    'import { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    'import { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\nimport { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    "login Turnstile import",
  ],
  [
    '  const [securityCode, setSecurityCode] = useState("");\n',
    '  const [securityCode, setSecurityCode] = useState("");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "login Turnstile state",
  ],
  [
    '    if (submitting) return;\n\n    setErrorMessage("");',
    '    if (submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    setErrorMessage("");',
    "login token requirement",
  ],
  [
    '    const result = await signIn(email.trim(), password);',
    '    const result = await signIn(email.trim(), password, turnstileToken);',
    "login token submit",
  ],
  [
    '    if (result.error) {\n      setErrorMessage(result.error.message);',
    '    if (result.error) {\n      setErrorMessage(result.error.message);\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);',
    "login token reset",
  ],
  [
    '        {errorMessage ? (\n',
    '        <TurnstileWidget\n          action="login"\n          onTokenChange={setTurnstileToken}\n          resetKey={turnstileResetKey}\n        />\n\n        {errorMessage ? (\n',
    "login widget",
  ],
  [
    '          disabled={submitting}\n',
    '          disabled={submitting || (turnstileRequired && !turnstileToken)}\n',
    "login submit gate",
  ],
]);

patchFile("src/routes/cadastro.tsx", [
  [
    'import { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    'import { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\nimport { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    "signup Turnstile import",
  ],
  [
    '  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");\n',
    '  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "signup Turnstile state",
  ],
  [
    '    if (!formReady || submitting) return;\n\n    setSubmitting(true);',
    '    if (!formReady || submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    setSubmitting(true);',
    "signup token requirement",
  ],
  [
    '      referralValidation === "invalid" ? null : referralCode,\n    );',
    '      referralValidation === "invalid" ? null : referralCode,\n      turnstileToken,\n    );',
    "signup token submit",
  ],
  [
    '    if (error) {\n      setErrorMessage(error.message);\n      setSubmitting(false);',
    '    if (error) {\n      setErrorMessage(error.message);\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);\n      setSubmitting(false);',
    "signup token reset",
  ],
  [
    '            {errorMessage ? (\n',
    '            <TurnstileWidget\n              action="signup"\n              onTokenChange={setTurnstileToken}\n              resetKey={turnstileResetKey}\n            />\n\n            {errorMessage ? (\n',
    "signup widget",
  ],
  [
    '              disabled={!formReady || submitting}\n',
    '              disabled={!formReady || submitting || (turnstileRequired && !turnstileToken)}\n',
    "signup submit gate",
  ],
]);

patchFile("src/routes/esqueci-senha.tsx", [
  [
    'import { BrandWordmark } from "@/components/brand/BrandWordmark";\n',
    'import { BrandWordmark } from "@/components/brand/BrandWordmark";\nimport { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\n',
    "recovery Turnstile import",
  ],
  [
    '  const [errorMessage, setErrorMessage] = useState("");\n',
    '  const [errorMessage, setErrorMessage] = useState("");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "recovery Turnstile state",
  ],
  [
    '    if (submitting) return;\n\n    const normalizedEmail = email.trim().toLowerCase();',
    '    if (submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    const normalizedEmail = email.trim().toLowerCase();',
    "recovery token requirement",
  ],
  [
    '    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {\n      ...(redirectTo ? { redirectTo } : {}),\n    });',
    '    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {\n      ...(redirectTo ? { redirectTo } : {}),\n      ...(turnstileToken ? { captchaToken: turnstileToken } : {}),\n    });',
    "recovery token submit",
  ],
  [
    '    if (error) {\n      setErrorMessage(\n        getUserFacingError(error, "Não foi possível enviar o e-mail de recuperação agora."),\n      );',
    '    if (error) {\n      setErrorMessage(\n        getUserFacingError(error, "Não foi possível enviar o e-mail de recuperação agora."),\n      );\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);',
    "recovery token reset",
  ],
  [
    '              {errorMessage ? (\n',
    '              <div className="mt-4">\n                <TurnstileWidget\n                  action="password_reset"\n                  onTokenChange={setTurnstileToken}\n                  resetKey={turnstileResetKey}\n                />\n              </div>\n\n              {errorMessage ? (\n',
    "recovery widget",
  ],
  [
    '                disabled={submitting}\n',
    '                disabled={submitting || (turnstileRequired && !turnstileToken)}\n',
    "recovery submit gate",
  ],
]);

console.log("Turnstile frontend patches applied successfully.");
