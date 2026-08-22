import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
    fullName?: string,
  ) => Promise<AuthActionResult>;

  signOut: () => Promise<AuthActionResult>;

  isCustomer: boolean;
  isOwner: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        console.error("Failed to restore auth session:", error);

        setSession(null);
        setUser(null);
        setRole(null);
        setRoleLoading(false);
        setAuthReady(true);

        return;
      }

      const currentSession = data.session;
      const currentUser = currentSession?.user ?? null;

      setSession(currentSession);
      setUser(currentUser);
      setRole(null);
      setRoleLoading(Boolean(currentUser));
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      const nextUser = nextSession?.user ?? null;

      setSession(nextSession);
      setUser(nextUser);
      setRole(null);
      setRoleLoading(Boolean(nextUser));
      setAuthReady(true);
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
    fullName?: string,
  ): Promise<AuthActionResult> {
    const normalizedFullName = fullName?.trim();

    const credentials = normalizedFullName
      ? {
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: normalizedFullName,
            },
          },
        }
      : {
          email: email.trim(),
          password,
        };

    const { error } = await supabase.auth.signUp(credentials);

    return { error };
  }

  async function signOut(): Promise<AuthActionResult> {
    const { error } = await supabase.auth.signOut();

    if (!error) {
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