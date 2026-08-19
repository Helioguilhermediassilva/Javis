import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { requireSupabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    try {
      const client = requireSupabase();
      client.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;
        if (error) setConfigurationError(error.message);
        setSession(data.session);
        setLoading(false);
      }).catch((error: unknown) => {
        if (!mounted) return;
        setConfigurationError(error instanceof Error ? error.message : "Não foi possível iniciar a autenticação.");
        setLoading(false);
      });
      const listener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) setSession(nextSession);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : "Autenticação indisponível.");
      setLoading(false);
    }
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configurationError,
    async signIn(email, password) {
      try {
        const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
        return { error: error ? new Error(error.message) : null };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error("Não foi possível entrar.") };
      }
    },
    async signUp(email, password, displayName) {
      try {
        const { data, error } = await requireSupabase().auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: displayName.trim().slice(0, 120) } },
        });
        return {
          error: error ? new Error(error.message) : null,
          needsEmailConfirmation: Boolean(data.user && !data.session),
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error("Não foi possível criar a conta."),
          needsEmailConfirmation: false,
        };
      }
    },
    async signOut() {
      try {
        const { error } = await requireSupabase().auth.signOut();
        return { error: error ? new Error(error.message) : null };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error("Não foi possível sair.") };
      }
    },
  }), [configurationError, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
