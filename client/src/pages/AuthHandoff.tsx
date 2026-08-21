import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { requireSupabase } from "@/lib/supabase";

function clearAuthParams() {
  const url = new URL(window.location.href);
  for (const key of ["code", "type", "token_hash", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export default function AuthHandoff() {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = requireSupabase();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        let authError: Error | null = null;

        if (code) {
          const result = await client.auth.exchangeCodeForSession(code);
          authError = result.error ? new Error(result.error.message) : null;
        } else if (tokenHash) {
          const result = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
          authError = result.error ? new Error(result.error.message) : null;
        } else {
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const result = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            authError = result.error ? new Error(result.error.message) : null;
          }
        }

        if (authError) throw authError;
        const current = await client.auth.getSession();
        if (current.error) throw new Error(current.error.message);
        if (!current.data.session) throw new Error("Sessão do Xavier não foi criada.");
        clearAuthParams();
        window.location.replace("/");
      } catch (cause) {
        if (!active) return;
        clearAuthParams();
        setError(cause instanceof Error ? cause.message : "Não foi possível concluir o acesso.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#00060a] px-6 text-center text-[#d8f8ff]">
      <section className="max-w-md border border-[#0d3347] bg-[#020e16] p-8 shadow-2xl">
        <p className="mb-3 text-[10px] uppercase tracking-[0.35em] text-[#00d4ff]">XAVIER / SSO</p>
        {error ? (
          <>
            <h1 className="mb-3 text-xl font-semibold">Não foi possível abrir o Xavier</h1>
            <p className="mb-6 text-sm text-[#8bb6c2]">{error}</p>
            <a className="text-sm text-[#00d4ff] underline" href="https://www.nowgoai.com/login?returnTo=%2F">
              Voltar ao NowGo AI
            </a>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-xl font-semibold">{t("common.session")}</h1>
            <p className="text-sm text-[#8bb6c2]">Preparando seu acesso seguro ao Xavier…</p>
          </>
        )}
      </section>
    </main>
  );
}
