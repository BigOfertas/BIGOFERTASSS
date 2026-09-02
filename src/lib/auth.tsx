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
import { onlyDigits } from "@/lib/brasil";

export type AppRole = Database["public"]["Enums"]["app_role"];

type AuthActionResult = {
  error: AuthError | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;

  signIn: (email: string, password: string) => Promise<AuthActionResult>;

  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    cpf: string,
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
      if (!active) {
        return;
      }

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const identityChanged = currentUserIdRef.current !== nextUserId;

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextUser);

      // TOKEN_REFRESHED, USER_UPDATED and duplicate INITIAL_SESSION events can
      // arrive while the same account is active (notably after returning to a
      // background browser tab). Keep the already-resolved role in that case.
      // Invalidating roleLoading without changing userId would leave loading
      // stuck because the role effect below would not run again.
      if (identityChanged) {
        setRole(null);
        setRoleLoading(Boolean(nextUser));
      }

      setAuthReady(true);
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

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

      if (!active) {
        return;
      }

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

  async function signIn(
    email: string,
    password: string,
  ): Promise<AuthActionResult> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error };
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    phone: string,
    cpf: string,
  ): Promise<AuthActionResult> {
    const emailRedirectTo = getEmailConfirmationRedirectUrl();

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName.trim(),
          phone: onlyDigits(phone, 11),
          cpf: onlyDigits(cpf, 11),
        },
      },
    });

    return { error };
  }

  async function resendSignUpConfirmation(
    email: string,
  ): Promise<AuthActionResult> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl(),
      },
    });

    return { error };
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

    return { error };
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
