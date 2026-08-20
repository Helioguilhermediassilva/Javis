import { useState, type FormEvent } from "react";
import { BrainCircuit, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NOWGO_SIGNUP_URL = "https://www.nowgoai.com/";
const USE_EXTERNAL_SIGNUP = import.meta.env.VITE_NOWGO_EXTERNAL_SIGNUP !== "false";

export default function Login() {
  const { signIn, signUp, configurationError } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (mode === "signup" && displayName.trim().length < 2) {
      setFeedback({ type: "error", text: "Informe como o Xavier deve chamar você." });
      return;
    }
    if (password.length < 6) {
      setFeedback({ type: "error", text: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setBusy(true);
    const result = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, displayName);
    setBusy(false);
    if (result.error) {
      setFeedback({ type: "error", text: result.error.message });
      return;
    }
    if (mode === "signup" && "needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      setFeedback({ type: "success", text: "Conta criada. Verifique seu e-mail para confirmar o acesso." });
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#00060a] px-4 py-10 text-[#8ffcff]">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.08) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/5 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden border border-[#0d3347] bg-[#010d14]/95 shadow-[0_0_70px_rgba(0,212,255,.12)] lg:grid-cols-[1fr_0.9fr]">
        <div className="hidden border-r border-[#0d3347] p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-12 flex items-center gap-3 text-sm tracking-[0.35em] text-[#00d4ff]">
              <BrainCircuit className="h-7 w-7" />
              XAVIER / ACCESS NODE
            </div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight text-[#d8f8ff]">Inteligência Soberana com memória sob seu controle.</h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-[#5ab8cc]">Conecte a interface web e o Telegram à mesma identidade. O Xavier mantém somente o contexto necessário, com limites de uso e memória que podem ser desativados.</p>
          </div>
          <div className="grid gap-3 text-xs text-[#3a8a9a]">
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-[#00ff88]" /> Dados separados por conta</div>
            <div className="flex items-center gap-3"><KeyRound className="h-4 w-4 text-[#00ff88]" /> Tokens administrativos nunca chegam ao navegador</div>
            <div className="flex items-center gap-3"><BrainCircuit className="h-4 w-4 text-[#00ff88]" /> Histórico enxuto e memória seletiva</div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><BrainCircuit className="h-6 w-6 text-[#00d4ff]" /><span className="text-sm tracking-[0.3em]">XAVIER</span></div>
          <div className="mb-8 flex border-b border-[#0d3347] text-xs uppercase tracking-[0.2em]">
            <button type="button" onClick={() => switchMode("login")} className={`flex-1 border-b-2 pb-3 transition ${mode === "login" ? "border-[#00d4ff] text-[#d8f8ff]" : "border-transparent text-[#3a8a9a] hover:text-[#8ffcff]"}`}>Entrar</button>
            <button type="button" onClick={() => USE_EXTERNAL_SIGNUP ? window.location.assign(NOWGO_SIGNUP_URL) : switchMode("signup")} className={`flex-1 border-b-2 pb-3 transition ${mode === "signup" ? "border-[#00d4ff] text-[#d8f8ff]" : "border-transparent text-[#3a8a9a] hover:text-[#8ffcff]"}`}>Criar conta</button>
          </div>

          <div className="mb-7">
            <p className="text-xs tracking-[0.25em] text-[#ff6b00]">SECURE SESSION</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#d8f8ff]">{mode === "login" ? "Acessar o cockpit" : "Iniciar sua identidade"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5ab8cc]">{mode === "login" ? "Entre para continuar sua conversa com o Xavier." : "Sua conta terá um espaço isolado para histórico e memória."}</p>
          </div>

          {configurationError && <div className="mb-5 border border-[#ff3355]/50 bg-[#ff3355]/10 p-3 text-xs leading-5 text-[#ff9aac]">{configurationError}</div>}
          {feedback && <div className={`mb-5 border p-3 text-xs leading-5 ${feedback.type === "error" ? "border-[#ff3355]/50 bg-[#ff3355]/10 text-[#ff9aac]" : "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#8dffc2]"}`}>{feedback.text}</div>}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#3a8a9a]">Como devo chamar você?</span><div className="relative"><UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3a8a9a]" /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full border border-[#0d3347] bg-[#00060a] px-10 py-3 text-sm text-[#d8f8ff] outline-none transition placeholder:text-[#28596a] focus:border-[#00d4ff]" placeholder="Nome de exibição" autoComplete="name" /></div></label>}
            <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#3a8a9a]">E-mail</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3a8a9a]" /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border border-[#0d3347] bg-[#00060a] px-10 py-3 text-sm text-[#d8f8ff] outline-none transition placeholder:text-[#28596a] focus:border-[#00d4ff]" placeholder="voce@exemplo.com" autoComplete="email" /></div></label>
            <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#3a8a9a]">Senha</span><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3a8a9a]" /><input type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-[#0d3347] bg-[#00060a] px-10 py-3 pr-12 text-sm text-[#d8f8ff] outline-none transition placeholder:text-[#28596a] focus:border-[#00d4ff]" placeholder="Mínimo de 6 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a8a9a] hover:text-[#8ffcff]" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
            <button type="submit" disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 bg-[#00d4ff] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#00060a] transition hover:bg-[#8ffcff] disabled:cursor-wait disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Abrir sessão" : "Criar identidade"}</button>
          </form>
          <p className="mt-6 text-center text-[10px] leading-5 text-[#3a8a9a]">Ao continuar, você concorda que o Xavier armazene o histórico textual necessário para responder e manter a continuidade. A memória poderá ser desligada e apagada no painel.</p>
        </div>
      </section>
    </main>
  );
}
