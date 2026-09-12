import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "auto" | "light" | "dark";
      size?: "normal" | "compact" | "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

let scriptPromise: Promise<void> | null = null;

function siteKey() {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || null;
}

export function isTurnstileEnabled() {
  return Boolean(siteKey());
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as TurnstileWindow).turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
}: {
  action: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const key = siteKey();

  useEffect(() => {
    if (!key || !containerRef.current) return;

    let active = true;
    let widgetId: string | null = null;
    onTokenChange(null);

    void loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current) return;
        const api = (window as TurnstileWindow).turnstile;
        if (!api) throw new Error("Turnstile API unavailable");
        widgetId = api.render(containerRef.current, {
          sitekey: key,
          action,
          theme: "auto",
          size: "flexible",
          callback: (token) => active && onTokenChange(token),
          "expired-callback": () => active && onTokenChange(null),
          "error-callback": () => active && onTokenChange(null),
        });
      })
      .catch(() => {
        if (active) onTokenChange(null);
      });

    return () => {
      active = false;
      onTokenChange(null);
      if (widgetId) (window as TurnstileWindow).turnstile?.remove(widgetId);
    };
  }, [action, key, onTokenChange, resetKey]);

  if (!key) return null;

  return (
    <div className="w-full" aria-label="Verificação de segurança">
      <div ref={containerRef} className="min-h-[65px] w-full" />
    </div>
  );
}
