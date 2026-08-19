import { ArrowRight, BrainCircuit, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";

export default function EmailConfirmed() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#00060a] px-4 py-10 text-[#8ffcff]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.08) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/5 blur-3xl" />

      <section className="relative w-full max-w-2xl border border-[#0d3347] bg-[#010d14]/95 p-7 shadow-[0_0_70px_rgba(0,212,255,.12)] sm:p-12">
        <div className="flex items-center gap-3 text-xs tracking-[0.35em] text-[#00d4ff]">
          <BrainCircuit className="h-6 w-6" />
          XAVIER / ACCESS NODE
        </div>

        <div className="mt-12 flex items-start gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#00ff88]">IDENTIDADE VALIDADA</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#d8f8ff] sm:text-4xl">
              E-mail confirmado com sucesso!
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#5ab8cc]">
              Sua identidade Xavier está ativa. Agora você pode abrir uma sessão segura e acessar o cockpit da sua conta.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-3 border-y border-[#0d3347] py-5 text-xs text-[#5ab8cc] sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <MailCheck className="h-4 w-4 text-[#00d4ff]" />
            E-mail verificado
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-[#00ff88]" />
            Acesso protegido por conta
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="mt-10 flex w-full items-center justify-center gap-2 bg-[#00d4ff] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#00060a] transition hover:bg-[#8ffcff] active:scale-[0.98]"
        >
          Ir para o login
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="mt-6 text-center text-[10px] leading-5 text-[#3a8a9a]">
          Inteligência Soberana · NowGo AI
        </p>
      </section>
    </main>
  );
}
