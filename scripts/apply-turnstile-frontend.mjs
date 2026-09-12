import fs from "node:fs";

function replaceOnce(content, before, after, label) {
  const occurrences = content.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${occurrences}`);
  }
  return content.replace(before, after);
}

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch produced no changes`);
  fs.writeFileSync(path, after);
}

patchFile("src/lib/auth.tsx", (input) => {
  let content = input;
  content = replaceOnce(
    content,
    '  signIn: (email: string, password: string) => Promise<SignInResult>;',
    '  signIn: (email: string, password: string, turnstileToken?: string | null) => Promise<SignInResult>;',
    "auth signIn type",
  );
  content = replaceOnce(
    content,
    '    referralCode?: string | null,\n  ) => Promise<AuthActionResult>;\n\n  resendSignUpConfirmation:',
    '    referralCode?: string | null,\n    captchaToken?: string | null,\n  ) => Promise<AuthActionResult>;\n\n  resendSignUpConfirmation:',
    "auth signUp type",
  );
  content = replaceOnce(
    content,
    '  async function signIn(email: string, password: string): Promise<SignInResult> {',
    '  async function signIn(\n    email: string,\n    password: string,\n    turnstileToken?: string | null,\n  ): Promise<SignInResult> {',
    "auth signIn implementation",
  );
  content = replaceOnce(
    content,
    '        body: { email: email.trim(), password },',
    '        body: {\n          email: email.trim(),\n          password,\n          ...(turnstileToken ? { turnstileToken } : {}),\n        },',
    "auth login token forwarding",
  );

  const signUpStart = content.indexOf("  async function signUp(");
  const signUpEnd = content.indexOf("  async function resendSignUpConfirmation", signUpStart);
  if (signUpStart < 0 || signUpEnd < 0) throw new Error("auth signUp section not found");
  const prefix = content.slice(0, signUpStart);
  let signUp = content.slice(signUpStart, signUpEnd);
  const suffix = content.slice(signUpEnd);
  signUp = replaceOnce(
    signUp,
    '    referralCode?: string | null,\n  ): Promise<AuthActionResult> {',
    '    referralCode?: string | null,\n    captchaToken?: string | null,\n  ): Promise<AuthActionResult> {',
    "auth signUp implementation args",
  );
  signUp = replaceOnce(
    signUp,
    '      options: {\n        ...(emailRedirectTo ? { emailRedirectTo } : {}),',
    '      options: {\n        ...(emailRedirectTo ? { emailRedirectTo } : {}),\n        ...(captchaToken ? { captchaToken } : {}),',
    "auth signup captcha option",
  );
  return prefix + signUp + suffix;
});

patchFile("src/routes/login.tsx", (input) => {
  let content = input;
  content = replaceOnce(
    content,
    'import { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    'import { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\nimport { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    "login Turnstile import",
  );
  content = replaceOnce(
    content,
    '  const [securityCode, setSecurityCode] = useState("");\n',
    '  const [securityCode, setSecurityCode] = useState("");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "login Turnstile state",
  );
  const submitStart = content.indexOf("  async function handleSubmit(");
  const submitEnd = content.indexOf("  async function handleVerifySecurityCode", submitStart);
  if (submitStart < 0 || submitEnd < 0) throw new Error("login submit section not found");
  const beforeSubmit = content.slice(0, submitStart);
  let submit = content.slice(submitStart, submitEnd);
  const afterSubmit = content.slice(submitEnd);
  submit = replaceOnce(
    submit,
    '    if (submitting) return;\n\n    setErrorMessage("");',
    '    if (submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    setErrorMessage("");',
    "login token requirement",
  );
  submit = replaceOnce(
    submit,
    '    const result = await signIn(email.trim(), password);',
    '    const result = await signIn(email.trim(), password, turnstileToken);',
    "login token submit",
  );
  submit = replaceOnce(
    submit,
    '    if (result.error) {\n      setErrorMessage(result.error.message);',
    '    if (result.error) {\n      setErrorMessage(result.error.message);\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);',
    "login token reset",
  );
  content = beforeSubmit + submit + afterSubmit;

  const loginFormMarker = '        {errorMessage ? (\n          <p\n            role="alert"\n            className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"';
  content = replaceOnce(
    content,
    loginFormMarker,
    '        <TurnstileWidget\n          action="login"\n          onTokenChange={setTurnstileToken}\n          resetKey={turnstileResetKey}\n        />\n\n' + loginFormMarker,
    "login widget",
  );
  content = replaceOnce(
    content,
    '          type="submit"\n          disabled={submitting}\n          className="premium-action inline-flex h-12 w-full items-center justify-center rounded-2xl',
    '          type="submit"\n          disabled={submitting || (turnstileRequired && !turnstileToken)}\n          className="premium-action inline-flex h-12 w-full items-center justify-center rounded-2xl',
    "login submit gate",
  );
  return content;
});

patchFile("src/routes/cadastro.tsx", (input) => {
  let content = input;
  content = replaceOnce(
    content,
    'import { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    'import { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\nimport { AuthSplitShell } from "@/components/ui/auth-split-shell";\n',
    "signup Turnstile import",
  );
  content = replaceOnce(
    content,
    '  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");\n',
    '  const [referralValidation, setReferralValidation] = useState<ReferralValidation>("idle");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "signup Turnstile state",
  );
  const submitStart = content.indexOf("  async function handleSubmit(");
  const submitEnd = content.indexOf("  async function handleResend", submitStart);
  if (submitStart < 0 || submitEnd < 0) throw new Error("signup submit section not found");
  const beforeSubmit = content.slice(0, submitStart);
  let submit = content.slice(submitStart, submitEnd);
  const afterSubmit = content.slice(submitEnd);
  submit = replaceOnce(
    submit,
    '    if (!formReady || submitting) return;\n\n    setSubmitting(true);',
    '    if (!formReady || submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    setSubmitting(true);',
    "signup token requirement",
  );
  submit = replaceOnce(
    submit,
    '      referralValidation === "invalid" ? null : referralCode,\n    );',
    '      referralValidation === "invalid" ? null : referralCode,\n      turnstileToken,\n    );',
    "signup token submit",
  );
  submit = replaceOnce(
    submit,
    '    if (error) {\n      setErrorMessage(error.message);\n      setSubmitting(false);',
    '    if (error) {\n      setErrorMessage(error.message);\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);\n      setSubmitting(false);',
    "signup token reset",
  );
  content = beforeSubmit + submit + afterSubmit;

  const signupErrorMarker = '            {errorMessage ? (\n              <p\n                role="alert"\n                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"';
  content = replaceOnce(
    content,
    signupErrorMarker,
    '            <TurnstileWidget\n              action="signup"\n              onTokenChange={setTurnstileToken}\n              resetKey={turnstileResetKey}\n            />\n\n' + signupErrorMarker,
    "signup widget",
  );
  content = replaceOnce(
    content,
    '              type="submit"\n              disabled={!formReady || submitting}\n              className="premium-action flex h-[52px] w-full items-center justify-center rounded-xl',
    '              type="submit"\n              disabled={!formReady || submitting || (turnstileRequired && !turnstileToken)}\n              className="premium-action flex h-[52px] w-full items-center justify-center rounded-xl',
    "signup submit gate",
  );
  return content;
});

patchFile("src/routes/esqueci-senha.tsx", (input) => {
  let content = input;
  content = replaceOnce(
    content,
    'import { BrandWordmark } from "@/components/brand/BrandWordmark";\n',
    'import { BrandWordmark } from "@/components/brand/BrandWordmark";\nimport { TurnstileWidget, isTurnstileEnabled } from "@/components/security/TurnstileWidget";\n',
    "recovery Turnstile import",
  );
  content = replaceOnce(
    content,
    '  const [errorMessage, setErrorMessage] = useState("");\n',
    '  const [errorMessage, setErrorMessage] = useState("");\n  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);\n  const [turnstileResetKey, setTurnstileResetKey] = useState(0);\n  const turnstileRequired = isTurnstileEnabled();\n',
    "recovery Turnstile state",
  );
  content = replaceOnce(
    content,
    '    if (submitting) return;\n\n    const normalizedEmail = email.trim().toLowerCase();',
    '    if (submitting) return;\n    if (turnstileRequired && !turnstileToken) {\n      setErrorMessage("Conclua a verificação de segurança para continuar.");\n      return;\n    }\n\n    const normalizedEmail = email.trim().toLowerCase();',
    "recovery token requirement",
  );
  content = replaceOnce(
    content,
    '    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {\n      ...(redirectTo ? { redirectTo } : {}),\n    });',
    '    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {\n      ...(redirectTo ? { redirectTo } : {}),\n      ...(turnstileToken ? { captchaToken: turnstileToken } : {}),\n    });',
    "recovery token submit",
  );
  content = replaceOnce(
    content,
    '    if (error) {\n      setErrorMessage(\n        getUserFacingError(error, "Não foi possível enviar o e-mail de recuperação agora."),\n      );',
    '    if (error) {\n      setErrorMessage(\n        getUserFacingError(error, "Não foi possível enviar o e-mail de recuperação agora."),\n      );\n      setTurnstileToken(null);\n      setTurnstileResetKey((value) => value + 1);',
    "recovery token reset",
  );
  const recoveryErrorMarker = '              {errorMessage ? (\n                <p\n                  role="alert"';
  content = replaceOnce(
    content,
    recoveryErrorMarker,
    '              <div className="mt-4">\n                <TurnstileWidget\n                  action="password_reset"\n                  onTokenChange={setTurnstileToken}\n                  resetKey={turnstileResetKey}\n                />\n              </div>\n\n' + recoveryErrorMarker,
    "recovery widget",
  );
  content = replaceOnce(
    content,
    '                type="submit"\n                disabled={submitting}\n                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md',
    '                type="submit"\n                disabled={submitting || (turnstileRequired && !turnstileToken)}\n                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md',
    "recovery submit gate",
  );
  return content;
});

console.log("Turnstile frontend patches applied successfully.");
