import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { legacyWorkerFallbackAvailable } from "@/lib/backend-routing";
import { getUserFacingError } from "@/lib/user-facing-error";

export type AppRole = Database["public"]["Enums"]["app_role"];

type AuthActionError = AuthError | Error;

type AuthActionResult = {
  error: AuthActionError | null;
};

type SignInResult = AuthActionResult & {
  requiresTwoFactor: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresAt?: string;
};

type PasswordSessionPayload = {
  accessToken: string;
  refreshToken: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;

  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifySignInTwoFactor: (
    email: string,
    password: string,
    challengeId: string,
    code: string,
  ) => Promise<AuthActionResult>;

  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<AuthActionResult>;

  resendSignUpConfirmation: (email: string) => Promise<AuthActionResult>;

  signOut: () => Promise<AuthActionResult>;

  isCustomer: boolean;
  isOwner: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getEmailConfirmationRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URL("/conta", window.location.origin).toString();
}

function authRequestError(message: string, fallback = "Não foi possível entrar agora.") {
  return new Error(getUserFacingError(message, fallback));
}

function friendlyAuthResult(error: AuthActionError | null, fallback: string): AuthActionResult {
  return {
    error: error ? new Error(getUserFacingError(error, fallback)) : null,
  };
}

async function readAuthResponse(response: Response) {
  try {
    const payload = await response.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function authEdgeUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  return supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/auth-email-2fa`
    : null;
}

async function postAuthRequest(
  url: string,
  body: Record<string, unknown>,
  authorization?: string,
) {
  return fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function authBackendRequest(input: {
  action:
    | "password-login"
    | "password-login-verify-2fa"
    | "enroll-start"
    | "enroll-verify";
  legacyPath: string;
  body?: Record<string, unknown>;
  authorization?: string;
}) {
  const body = input.body ?? {};
  const edgeUrl = authEdgeUrl();

  if (edgeUrl) {
    try {
      const edgeResponse = await postAuthRequest(
        edgeUrl,
        { action: input.action, ...body },
        input.authorization,
      );
      if (edgeResponse.status < 500 || !legacyWorkerFallbackAvailable()) {
        return edgeResponse;
      }
    } catch (error) {
      if (!legacyWorkerFallbackAvailable()) throw error;
    }
  }

  if (legacyWorkerFallbackAvailable()) {
    return postAuthRequest(input.legacyPath, body, input.authorization);
  }

  throw new Error("O acesso à conta está temporariamente indisponível.");
}

function readPasswordSession(payload: Record<string, unknown> | null) {
  const session = payload?.["session"];
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;

  const record = session as Record<string, unknown>;
  if (
    typeof record["accessToken"] !== "string" ||
    typeof record["refreshToken"] !== "string"
  ) {
    return null;
  }

  return {
    accessToken: record["accessToken"],
    refreshToken: record["refreshToken"],
  } satisfies PasswordSessionPayload;
}

async function applyPasswordSession(payload: PasswordSessionPayload): Promise<AuthActionResult> {
  const { error } = await supabase.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  });
  return friendlyAuthResult(error, "Não foi possível concluir a entrada na sua conta.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const currentUserIdRef = useRef<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let active = true;

    function applySession(nextSession: Session | null) {
      if (!active) return;

      const nextUser = nextSession?.user ?? null;

      if (nextUser && !nextUser.email_confirmed_at) {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setRoleLoading(false);
        setAuthReady(true);
        void supabase.auth.signOut();
        return;
      }

      const nextUserId = nextUser?.id ?? null;
      const identityChanged = currentUserIdRef.current !== nextUserId;

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextUser);

      if (identityChanged) {
        setRole(null);
        setRoleLoading(Boolean(nextUser));
      }

      setAuthReady(true);
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error("Failed to restore auth session:", error);
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setRoleLoading(false);
        setAuthReady(true);
        return;
      }

      applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      return () => {
        active = false;
      };
    }

    setRoleLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Failed to load user role:", error);
        setRole(null);
      } else {
        setRole(data?.role ?? null);
      }

      setRoleLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  async function signIn(email: string, password: string): Promise<SignInResult> {
    let response: Response;
    try {
      response = await authBackendRequest({
        action: "password-login",
        legacyPath: "/api/auth/password-login",
        body: { email: email.trim(), password },
      });
    } catch {
      return {
        error: authRequestError(
          "Não foi possível entrar agora. Verifique sua conexão.",
          "Não foi possível entrar agora. Verifique sua conexão.",
        ),
        requiresTwoFactor: false,
      };
    }

    const payload = await readAuthResponse(response);
    if (!response.ok) {
      return {
        error: authRequestError(
          payload && typeof payload["error"] === "string"
            ? payload["error"]
            : "Não foi possível entrar agora.",
        ),
        requiresTwoFactor: false,
      };
    }

    if (payload?.["requiresTwoFactor"] === true) {
      const challengeId = payload["challengeId"];
      const maskedEmail = payload["maskedEmail"];
      const expiresAt = payload["expiresAt"];
      if (
        typeof challengeId !== "string" ||
        typeof maskedEmail !== "string" ||
        typeof expiresAt !== "string"
      ) {
        return {
          error: authRequestError(
            "Não foi possível iniciar a verificação em duas etapas.",
            "Não foi possível iniciar a verificação em duas etapas.",
          ),
          requiresTwoFactor: false,
        };
      }

      return {
        error: null,
        requiresTwoFactor: true,
        challengeId,
        maskedEmail,
        expiresAt,
      };
    }

    const nextSession = readPasswordSession(payload);
    if (!nextSession) {
      return {
        error: authRequestError(
          "Não foi possível concluir a entrada na sua conta.",
          "Não foi possível concluir a entrada na sua conta.",
        ),
        requiresTwoFactor: false,
      };
    }

    const sessionResult = await applyPasswordSession(nextSession);
    return { ...sessionResult, requiresTwoFactor: false };
  }

  async function verifySignInTwoFactor(
    email: string,
    password: string,
    challengeId: string,
    code: string,
  ): Promise<AuthActionResult> {
    let response: Response;
    try {
      response = await authBackendRequest({
        action: "password-login-verify-2fa",
        legacyPath: "/api/auth/password-login/verify-2fa",
        body: {
          email: email.trim(),
          password,
          challengeId,
          code: code.trim(),
        },
      });
    } catch {
      return { error: authRequestError("Não foi possível confirmar o código agora.") };
    }

    const payload = await readAuthResponse(response);
    if (!response.ok) {
      return {
        error: authRequestError(
          payload && typeof payload["error"] === "string"
            ? payload["error"]
            : "Não foi possível confirmar o código agora.",
          "Não foi possível confirmar o código agora.",
        ),
      };
    }

    const nextSession = readPasswordSession(payload);
    if (!nextSession) {
      return {
        error: authRequestError(
          "Não foi possível concluir a entrada na sua conta.",
          "Não foi possível concluir a entrada na sua conta.",
        ),
      };
    }

    return await applyPasswordSession(nextSession);
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthActionResult> {
    const emailRedirectTo = getEmailConfirmationRedirectUrl();

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    return friendlyAuthResult(error, "Não foi possível criar sua conta agora.");
  }

  async function resendSignUpConfirmation(
    email: string,
  ): Promise<AuthActionResult> {
    const emailRedirectTo = getEmailConfirmationRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    return friendlyAuthResult(
      error,
      "Não foi possível reenviar o e-mail de confirmação agora.",
    );
  }

  async function signOut(): Promise<AuthActionResult> {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      currentUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setRole(null);
      setRoleLoading(false);
    }

    return friendlyAuthResult(error, "Não foi possível sair da conta agora.");
  }

  const loading = !authReady || (Boolean(user) && roleLoading);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        loading,
        signIn,
        verifySignInTwoFactor,
        signUp,
        resendSignUpConfirmation,
        signOut,
        isCustomer: role === "customer",
        isOwner: role === "owner",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
