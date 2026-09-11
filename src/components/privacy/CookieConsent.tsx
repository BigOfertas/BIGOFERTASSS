import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const CONSENT_COOKIE = "dropbox_cookie_consent_v1";
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const COOKIE_PREFERENCES_EVENT = "dropbox:open-cookie-preferences";
export const COOKIE_CONSENT_CHANGED_EVENT = "dropbox:cookie-consent-changed";

type OptionalCookiePreferences = {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentState = OptionalCookiePreferences & {
  necessary: true;
  updatedAt: string;
};

const REJECTED_OPTIONAL: OptionalCookiePreferences = {
  preferences: false,
  analytics: false,
  marketing: false,
};

const ACCEPTED_OPTIONAL: OptionalCookiePreferences = {
  preferences: true,
  analytics: true,
  marketing: true,
};

function readConsentCookie(): CookieConsentState | null {
  if (typeof document === "undefined") return null;

  const prefix = `${CONSENT_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(prefix.length))) as Partial<CookieConsentState>;
    if (
      parsed.necessary !== true ||
      typeof parsed.preferences !== "boolean" ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }

    return {
      necessary: true,
      preferences: parsed.preferences,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function writeConsentCookie(preferences: OptionalCookiePreferences) {
  const consent: CookieConsentState = {
    necessary: true,
    ...preferences,
    updatedAt: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(
    new CustomEvent<CookieConsentState>(COOKIE_CONSENT_CHANGED_EVENT, { detail: consent }),
  );

  return consent;
}

function PreferenceToggle({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex gap-3 rounded-2xl border px-3.5 py-3 ${
        disabled ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-gray-950">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1 h-5 w-5 flex-none accent-red-600"
      />
    </label>
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [hasSavedConsent, setHasSavedConsent] = useState(false);
  const [preferences, setPreferences] = useState<OptionalCookiePreferences>(REJECTED_OPTIONAL);

  useEffect(() => {
    const saved = readConsentCookie();
    if (saved) {
      setHasSavedConsent(true);
      setPreferences({
        preferences: saved.preferences,
        analytics: saved.analytics,
        marketing: saved.marketing,
      });
    } else {
      setVisible(true);
    }

    const openPreferences = () => {
      const current = readConsentCookie();
      if (current) {
        setHasSavedConsent(true);
        setPreferences({
          preferences: current.preferences,
          analytics: current.analytics,
          marketing: current.marketing,
        });
      }
      setCustomizing(true);
      setVisible(true);
    };

    window.addEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
  }, []);

  function save(next: OptionalCookiePreferences) {
    writeConsentCookie(next);
    setPreferences(next);
    setHasSavedConsent(true);
    setCustomizing(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-[22px] border border-gray-200 bg-white p-4 shadow-[0_18px_55px_rgba(17,24,39,0.22)] sm:inset-x-5 sm:bottom-5 sm:p-5"
    >
      <div className="mx-auto h-1 w-12 rounded-full bg-red-600" aria-hidden="true" />

      {customizing ? (
        <div className="mt-3 max-h-[72vh] overflow-y-auto pr-0.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-black tracking-[-0.02em] text-gray-950">
                Escolha suas preferências
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Os recursos necessários ficam sempre ativos. Os demais só ficam autorizados se você
                permitir.
              </p>
            </div>
            {hasSavedConsent ? (
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="flex-none rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <PreferenceToggle
              checked
              disabled
              label="Necessários"
              description="Mantêm recursos essenciais do site, como segurança, sessão, carrinho e registro da sua escolha de cookies."
            />
            <PreferenceToggle
              checked={preferences.preferences}
              label="Preferências"
              description="Permitem lembrar escolhas de experiência e exibição quando esses recursos estiverem disponíveis."
              onChange={(checked) =>
                setPreferences((current) => ({ ...current, preferences: checked }))
              }
            />
            <PreferenceToggle
              checked={preferences.analytics}
              label="Análise"
              description="Autoriza métricas de uso e desempenho caso ferramentas de análise sejam ativadas no site."
              onChange={(checked) =>
                setPreferences((current) => ({ ...current, analytics: checked }))
              }
            />
            <PreferenceToggle
              checked={preferences.marketing}
              label="Marketing"
              description="Autoriza recursos de medição promocional caso ferramentas desse tipo sejam ativadas no futuro."
              onChange={(checked) =>
                setPreferences((current) => ({ ...current, marketing: checked }))
              }
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => save(REJECTED_OPTIONAL)}
              className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-extrabold text-gray-800 transition-colors hover:bg-gray-50"
            >
              Recusar opcionais
            </button>
            <button
              type="button"
              onClick={() => save(preferences)}
              className="h-11 rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-white transition-colors hover:bg-gray-800"
            >
              Salvar escolhas
            </button>
            <button
              type="button"
              onClick={() => save(ACCEPTED_OPTIONAL)}
              className="h-11 rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white transition-colors hover:bg-red-700"
            >
              Aceitar todos
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 sm:flex sm:items-center sm:gap-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black tracking-[-0.02em] text-gray-950">
              Sua privacidade importa
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">
              Usamos armazenamento necessário para o funcionamento da loja. Você pode aceitar,
              recusar os recursos opcionais ou escolher suas preferências. Veja nossa{" "}
              <Link to="/privacidade" className="font-bold text-gray-900 underline underline-offset-2">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>

          <div className="mt-4 grid flex-none grid-cols-2 gap-2 sm:mt-0 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => save(REJECTED_OPTIONAL)}
              className="h-10 rounded-xl border border-gray-300 px-3 text-xs font-extrabold text-gray-800 transition-colors hover:bg-gray-50"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="h-10 rounded-xl bg-gray-950 px-3 text-xs font-extrabold text-white transition-colors hover:bg-gray-800"
            >
              Escolher
            </button>
            <button
              type="button"
              onClick={() => save(ACCEPTED_OPTIONAL)}
              className="col-span-2 h-10 rounded-xl bg-red-600 px-3 text-xs font-extrabold text-white transition-colors hover:bg-red-700 sm:col-span-1"
            >
              Aceitar todos
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
