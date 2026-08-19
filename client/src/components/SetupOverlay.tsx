import { useEffect, useState } from "react";

const C = {
  BG: "#00060a",
  BORDER_B: "#1a5c7a",
  PRI: "#00d4ff",
  PRI_DIM: "#007a99",
  PRI_GHO: "#001f2e",
  GREEN: "#00ff88",
  RED: "#ff3355",
  TEXT: "#8ffcff",
  TEXT_DIM: "#3a8a9a",
  TEXT_MED: "#5ab8cc",
  WHITE: "#d8f8ff",
  BORDER: "#0d3347",
  PANEL: "#010d14",
};

export type Honorific = "senhor" | "senhora";
export type ActivationMode = "continuous" | "wakeword";

export interface JarvisPrefs {
  voiceEnabled: boolean;
  micEnabled: boolean;
  honorific: Honorific;
  activationMode: ActivationMode;
}

const PREFS_KEY = "jarvis-prefs";

export const DEFAULT_PREFS: JarvisPrefs = {
  voiceEnabled: true,
  micEnabled: true,
  honorific: "senhor",
  activationMode: "continuous",
};

export function loadPrefs(): JarvisPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<JarvisPrefs>;
    return {
      voiceEnabled: parsed.voiceEnabled ?? DEFAULT_PREFS.voiceEnabled,
      micEnabled: parsed.micEnabled ?? DEFAULT_PREFS.micEnabled,
      honorific: parsed.honorific === "senhora" ? "senhora" : DEFAULT_PREFS.honorific,
      activationMode: (parsed.activationMode as ActivationMode) ?? DEFAULT_PREFS.activationMode,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

interface SetupOverlayProps {
  onDone: (prefs: JarvisPrefs) => void;
}

export default function SetupOverlay({ onDone }: SetupOverlayProps) {
  const [prefs, setPrefs] = useState<JarvisPrefs>(() => DEFAULT_PREFS);

  // Carrega preferências persistidas (se houver) na primeira renderização.
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const handleSubmit = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    onDone(prefs);
  };

  const Toggle = ({ label, value, onClick, valueLabel }: { label: string; value: boolean; onClick: () => void; valueLabel: [string, string] }) => (
    <button
      onClick={onClick}
      className="flex items-center justify-between h-9 px-3 text-[9px] font-bold rounded-sm transition-all"
      style={{
        background: value ? C.PRI_GHO : "transparent",
        color: value ? C.PRI : C.TEXT_DIM,
        border: `1px solid ${value ? C.PRI : C.BORDER}`,
      }}
    >
      <span>{label}</span>
      <span>{value ? valueLabel[0] : valueLabel[1]}</span>
    </button>
  );

  const Pill = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex-1 h-7 px-2 text-[8px] font-bold rounded-sm transition-all"
      style={{
        background: active ? C.PRI_GHO : "transparent",
        color: active ? C.PRI : C.TEXT_DIM,
        border: `1px solid ${active ? C.PRI : C.BORDER}`,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,6,10,0.92)" }}
    >
      <div
        className="w-[460px] p-8 rounded-md max-h-[90vh] overflow-y-auto"
        style={{
          background: "rgba(0,6,10,0.96)",
          border: `1px solid ${C.BORDER_B}`,
        }}
      >
        {/* Título */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold" style={{ color: C.PRI }}>
            XAVIER — INICIALIZAÇÃO
          </h2>
          <p className="text-[8px] mt-1" style={{ color: C.TEXT_DIM }}>
            Configure sua interface antes de ativar o XAVIER
          </p>
        </div>

        {/* Preferências de hardware */}
        <div className="mb-5">
          <label className="block text-[8px] font-bold mb-2" style={{ color: C.TEXT_MED }}>
            ENTRADA / SAÍDA
          </label>
          <div className="flex flex-col gap-2">
            <Toggle
              label="VOZ DO XAVIER (alto-falantes)"
              value={prefs.voiceEnabled}
              valueLabel={["ATIVADA", "DESATIVADA"]}
              onClick={() => setPrefs((p) => ({ ...p, voiceEnabled: !p.voiceEnabled }))}
            />
            <Toggle
              label="MICROFONE (reconhecimento de voz)"
              value={prefs.micEnabled}
              valueLabel={["ATIVADO", "DESATIVADO"]}
              onClick={() => setPrefs((p) => ({ ...p, micEnabled: !p.micEnabled }))}
            />
          </div>
        </div>

        {/* Tratamento (gênero) */}
        <div className="mb-5">
          <label className="block text-[8px] font-bold mb-2" style={{ color: C.TEXT_MED }}>
            COMO O XAVIER DEVE TRATAR VOCÊ?
          </label>
          <div className="flex gap-2">
            <Pill active={prefs.honorific === "senhor"} label="SENHOR" onClick={() => setPrefs((p) => ({ ...p, honorific: "senhor" }))} />
            <Pill active={prefs.honorific === "senhora"} label="SENHORA" onClick={() => setPrefs((p) => ({ ...p, honorific: "senhora" }))} />
          </div>
          <p className="text-[7px] mt-2 leading-relaxed" style={{ color: C.TEXT_DIM }}>
            O XAVIER aplicará o tratamento escolhido em todas as respostas e na concordância.
          </p>
        </div>

        {/* Modo de ativação por voz */}
        <div className="mb-5">
          <label className="block text-[8px] font-bold mb-2" style={{ color: C.TEXT_MED }}>
            ATIVAÇÃO POR VOZ
          </label>
          <div className="flex gap-2">
            <Pill active={prefs.activationMode === "continuous"} label="CONTÍNUA" onClick={() => setPrefs((p) => ({ ...p, activationMode: "continuous" }))} />
            <Pill active={prefs.activationMode === "wakeword"} label="WAKE-WORD: 'EI XAVIER'" onClick={() => setPrefs((p) => ({ ...p, activationMode: "wakeword" }))} />
          </div>
          <p className="text-[7px] mt-2 leading-relaxed" style={{ color: C.TEXT_DIM }}>
            {prefs.activationMode === "wakeword"
              ? "O XAVIER só processará comandos que comecem com 'XAVIER' ou 'Ei XAVIER'. Útil em ambientes com conversa de fundo (gabinete, reuniões)."
              : "Tudo que o microfone captar vai ser enviado ao XAVIER. Recomendado em ambiente silencioso."}
          </p>
        </div>

        <p className="text-[7px] mb-4 leading-relaxed" style={{ color: C.TEXT_DIM }}>
          Idioma fixado em Português (Brasil). Ao ativar, o navegador poderá pedir permissão para o microfone.
        </p>

        {/* Activate */}
        <button
          onClick={handleSubmit}
          className="w-full h-10 text-[10px] font-bold rounded-sm transition-all hover:brightness-125"
          style={{
            background: C.PRI_GHO,
            color: C.GREEN,
            border: `1px solid ${C.GREEN}`,
          }}
        >
          ▸ ATIVAR XAVIER
        </button>
      </div>
    </div>
  );
}
