import { useState, useEffect, useCallback, useRef } from "react";
import HudCanvas, { type HudState } from "@/components/HudCanvas";
import MetricBar from "@/components/MetricBar";
import LogWidget from "@/components/LogWidget";
import FileDropZone from "@/components/FileDropZone";
import SetupOverlay, { loadPrefs, DEFAULT_PREFS, type JarvisPrefs } from "@/components/SetupOverlay";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { jarvisChatStream, fileToAttachment, type ChatMessage, type AttachmentRef } from "@/lib/jarvisLLM";
import { matchWakeWord, WakeWordArmedWindow } from "@/lib/wakeWord";
import DfBriefingPanel from "@/components/DfBriefingPanel";

const C = {
  BG: "#00060a",
  PANEL: "#010d14",
  PANEL2: "#010f18",
  BORDER: "#0d3347",
  BORDER_B: "#1a5c7a",
  BORDER_A: "#0f4060",
  PRI: "#00d4ff",
  PRI_DIM: "#007a99",
  PRI_GHO: "#001f2e",
  ACC: "#ff6b00",
  ACC2: "#ffcc00",
  GREEN: "#00ff88",
  GREEN_D: "#00aa55",
  RED: "#ff3355",
  MUTED_C: "#ff3366",
  TEXT: "#8ffcff",
  TEXT_DIM: "#3a8a9a",
  TEXT_MED: "#5ab8cc",
  WHITE: "#d8f8ff",
  DARK: "#000d14",
  BAR_BG: "#011520",
};

// Simulated system metrics with smooth transitions
function useSimulatedMetrics() {
  const [metrics, setMetrics] = useState({
    cpu: 23,
    mem: 42,
    net: 12,
    gpu: 31,
    tmp: 52,
  });

  useEffect(() => {
    const update = () => {
      setMetrics((prev) => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.48) * 8)),
        mem: Math.max(25, Math.min(80, prev.mem + (Math.random() - 0.5) * 3)),
        net: Math.max(0, Math.min(90, prev.net + (Math.random() - 0.5) * 15)),
        gpu: Math.max(5, Math.min(90, prev.gpu + (Math.random() - 0.48) * 6)),
        tmp: Math.max(38, Math.min(78, prev.tmp + (Math.random() - 0.5) * 2)),
      }));
    };
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export default function Home() {
  const [hudState, setHudState] = useState<HudState>("INITIALISING");
  const [muted, setMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [showSetup, setShowSetup] = useState(true);
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutedRef = useRef(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const processingRef = useRef(false);
  const prefsRef = useRef<JarvisPrefs>(DEFAULT_PREFS);
  // Janela de "armado" do wake-word: após o usuário dizer só "Ei XAVIER",
  // ficamos 8s aceitando a próxima fala como comando direto.
  const wakeArmedRef = useRef(new WakeWordArmedWindow(8000));

  // TTS: voz original do XAVIER via ElevenLabs, com fallback local silencioso apenas em caso de indisponibilidade temporária.
  const elevenTts = useElevenLabsTTS();
  const browserTts = useSpeechSynthesis({ lang: "pt-BR", rate: 1.0, pitch: 1.0 });
  const ttsRef = useRef({ elevenTts, browserTts });
  useEffect(() => { ttsRef.current = { elevenTts, browserTts }; }, [elevenTts, browserTts]);

  // Mantém a voz original como caminho principal; o fallback local não altera o estado da voz nem cria um alerta enganoso no registro.
  const speakReply = useCallback((text: string, onEnd: () => void) => {
    if (mutedRef.current) { onEnd(); return; }
    ttsRef.current.elevenTts
      .speak(text)
      .then(() => onEnd())
      .catch(() => {
        // O fallback evita deixar a interface sem resposta quando o serviço remoto
        // estiver indisponível, mas não anuncia uma troca permanente de voz.
        ttsRef.current.browserTts.speak(text, onEnd);
      });
  }, []);

  // Pending attachments to send with the next user message
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentRef[]>([]);
  const pendingAttachmentsRef = useRef<AttachmentRef[]>([]);
  useEffect(() => { pendingAttachmentsRef.current = pendingAttachments; }, [pendingAttachments]);

  // Process a user command — call LLM and speak the answer in pt-BR
  const processCommand = useCallback(async (text: string) => {
    if (!text.trim() && pendingAttachmentsRef.current.length === 0) return;
    if (processingRef.current) return;
    processingRef.current = true;
    const attachmentsToSend = pendingAttachmentsRef.current;
    const userLogText = text.trim() || (attachmentsToSend[0]?.name ? `[anexo: ${attachmentsToSend[0]?.name}]` : "[anexo]");
    setLogs((l) => [...l, `Você: ${userLogText}`]);
    setHudState("THINKING");
    setPendingAttachments([]);
    setCurrentFile(null);
    try {
      // Índice da linha "Xavier: ..." no log para atualizar incrementalmente
      // conforme os deltas chegam (sem criar uma linha por delta).
      let liveLogIndex = -1;
      let liveBuffer = "";
      const reply = await jarvisChatStream({
        history: historyRef.current,
        userMessage: text,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
        honorific: prefsRef.current.honorific,
        onDelta: (chunk) => {
          liveBuffer += chunk;
          setLogs((l) => {
            if (liveLogIndex === -1) {
              liveLogIndex = l.length;
              return [...l, `Xavier: ${liveBuffer}`];
            }
            const next = l.slice();
            next[liveLogIndex] = `Xavier: ${liveBuffer}`;
            return next;
          });
        },
        onToolStart: (names) => {
          setLogs((l) => [...l, `SYS: consultando fontes (${names.join(", ")})...`]);
        },
      });
      const userContentForHistory = attachmentsToSend.length > 0
        ? `${text}${attachmentsToSend.map(a => ` [anexo: ${a.name || a.kind}]`).join("")}`
        : text;
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, content: userContentForHistory },
        { role: "assistant" as const, content: reply },
      ].slice(-20);
      // Garante que a linha final do log tenha a resposta completa exatamente
      // como retornada (caso o LLM tenha refinado depois das tool calls).
      setLogs((l) => {
        if (liveLogIndex === -1) return [...l, `Xavier: ${reply}`];
        const next = l.slice();
        next[liveLogIndex] = `Xavier: ${reply}`;
        return next;
      });
      setHudState("SPEAKING");
      speakReply(reply, () => {
        processingRef.current = false;
        setHudState(mutedRef.current ? "MUTED" : "LISTENING");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((l) => [...l, `SYS: Erro — ${msg}`]);
      processingRef.current = false;
      setHudState(mutedRef.current ? "MUTED" : "LISTENING");
    }
  }, [speakReply]);

  // STT em pt-BR. Quando o modo wake-word está ativo, filtramos as falas
  // antes de enviar ao LLM.
  const handleSttFinal = useCallback((txt: string) => {
    if (mutedRef.current || processingRef.current) return;
    const trimmed = txt.trim();
    if (!trimmed) return;
    if (prefsRef.current.activationMode === "wakeword") {
      // Janela de armado: se acabamos de dizer "Ei XAVIER" e ouvimos algo dentro
      // de 8s, processamos direto.
      if (wakeArmedRef.current.isArmed()) {
        wakeArmedRef.current.disarm();
        processCommand(trimmed);
        return;
      }
      const m = matchWakeWord(trimmed);
      if (!m.matched) {
        // Ignorado silenciosamente (ruído de fundo / conversa paralela)
        return;
      }
      if (m.command) {
        processCommand(m.command);
      } else {
        // Só "Ei XAVIER" sem comando — acusa presença e abre janela armada.
        wakeArmedRef.current.arm();
        const honorific = prefsRef.current.honorific;
        const reply = honorific === "senhora" ? "Senhora?" : "Senhor?";
        setLogs((l) => [...l, `Xavier: ${reply}`]);
        setHudState("SPEAKING");
        speakReply(reply, () => setHudState(mutedRef.current ? "MUTED" : "LISTENING"));
      }
      return;
    }
    processCommand(trimmed);
  }, [processCommand, speakReply]);

  const stt = useSpeechRecognition({
    lang: "pt-BR",
    continuous: true,
    interimResults: true,
    onFinalResult: handleSttFinal,
  });

  const metrics = useSimulatedMetrics();

  // Relógio em pt-BR
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("pt-BR", { hour12: false }));
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      setDate(`${days[now.getDay()]} ${now.getDate().toString().padStart(2, "0")} ${months[now.getMonth()]} ${now.getFullYear()}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Start STT when LISTENING; stop otherwise.
  const sttRef = useRef(stt);
  useEffect(() => { sttRef.current = stt; }, [stt]);
  useEffect(() => {
    if (showSetup) return;
    const s = sttRef.current;
    if (!s.isSupported) return;
    if (hudState === "LISTENING" && !mutedRef.current) {
      s.start();
    } else {
      s.stop();
    }
  }, [hudState, showSetup]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        e.preventDefault();
        toggleMute();
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      setHudState("MUTED");
      setLogs((l) => [...l, "SYS: Microfone silenciado."]);
      ttsRef.current.elevenTts.cancel();
      ttsRef.current.browserTts.cancel();
    } else {
      setHudState("LISTENING");
      setLogs((l) => [...l, "SYS: Microfone ativo."]);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Quando o usuário clica em "ATIVAR XAVIER", o gesto desbloqueia autoplay de áudio
  // e podemos solicitar permissão de microfone com segurança.
  const handleSetupDone = useCallback((prefs: JarvisPrefs) => {
    prefsRef.current = prefs;
    setShowSetup(false);
    setHudState("LISTENING");
    setLogs((l) => [...l, "SYS: Sistema inicializado. XAVIER online."]);
    if (prefs.activationMode === "wakeword") {
      setLogs((l) => [...l, "SYS: Modo wake-word ativo — diga 'Ei XAVIER' antes do comando."]);
    }

    // Saudação falada adaptada ao tratamento escolhido. Esta primeira chamada
    // de áudio acontece DENTRO do gesto de clique, garantindo autoplay.
    const greet =
      prefs.honorific === "senhora"
        ? "À sua disposição, senhora. Como posso ajudar?"
        : "À sua disposição, senhor. Como posso ajudar?";
    setLogs((l) => [...l, `Xavier: ${greet}`]);
    setHudState("SPEAKING");
    speakReply(greet, () => setHudState(mutedRef.current ? "MUTED" : "LISTENING"));
  }, [speakReply]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && pendingAttachmentsRef.current.length === 0) return;
    setInputText("");
    processCommand(text);
  }, [inputText, processCommand]);

  const handleFileSelected = useCallback(async (file: File) => {
    setCurrentFile(file);
    const size = file.size < 1024 ? `${file.size} B` :
      file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` :
      `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setLogs((l) => [...l, `ARQ: ${file.name} (${size}) carregado`]);
    try {
      const att = await fileToAttachment(file);
      setPendingAttachments([att]);
      setLogs((l) => [...l, `SYS: Pronto — pergunte algo sobre ${file.name} ou pressione \u25b8 para enviar`]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((l) => [...l, `SYS: Erro ao ler arquivo — ${msg}`]);
      setCurrentFile(null);
    }
  }, []);

  const handleFileClear = useCallback(() => {
    setCurrentFile(null);
    setPendingAttachments([]);
  }, []);

  // Uptime simulation
  const [uptime, setUptime] = useState("00:00");
  const [procCount, setProcCount] = useState(186);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      setUptime(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      setProcCount(180 + Math.floor(Math.random() * 40));
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, []);

  const netStr = metrics.net < 10 ? `${(metrics.net * 102.4).toFixed(0)}KB/s` : `${(metrics.net / 10).toFixed(1)}MB/s`;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: C.BG, minWidth: "1080px", minHeight: "580px" }}>
      {/* HEADER */}
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: "54px",
          background: C.DARK,
          borderBottom: `1px solid ${C.BORDER_B}`,
        }}
      >
        <span className="text-[8px] font-bold tracking-wider" style={{ color: C.PRI_DIM }}>
          NOWGO AI
        </span>
        <div className="text-center">
          <div className="text-[17px] font-bold tracking-[0.15em]" style={{ color: C.PRI }}>
            XAVIER
          </div>
          <div className="text-[7px] tracking-wider" style={{ color: C.PRI_DIM }}>
            Sistema Inteligente Operacional · NowGo AI
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-bold tabular-nums" style={{ color: C.PRI }}>
            {clock}
          </div>
          <div className="text-[7px]" style={{ color: C.TEXT_DIM }}>
            {date}
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <aside
          className="flex flex-col shrink-0 overflow-hidden"
          style={{
            width: "148px",
            background: C.DARK,
            borderRight: `1px solid ${C.BORDER}`,
            padding: "10px 8px",
            gap: "6px",
          }}
        >
          <div
            className="text-[7px] font-bold pb-1"
            style={{ color: C.PRI, borderBottom: `1px solid ${C.BORDER}` }}
          >
            ◈ MONITOR DO SISTEMA
          </div>

          <MetricBar label="CPU" value={metrics.cpu} text={`${metrics.cpu.toFixed(0)}%`} color={C.PRI} />
          <MetricBar label="MEM" value={metrics.mem} text={`${metrics.mem.toFixed(0)}%`} color={C.ACC2} />
          <MetricBar label="REDE" value={metrics.net} text={netStr} color={C.GREEN} />
          <MetricBar label="GPU" value={metrics.gpu} text={`${metrics.gpu.toFixed(0)}%`} color={C.ACC} />
          <MetricBar label="TMP" value={metrics.tmp} text={`${metrics.tmp.toFixed(0)}°C`} color="#ff6688" />

          <div
            className="mt-1 rounded-sm"
            style={{ background: C.PANEL2, border: `1px solid ${C.BORDER}`, padding: "5px 6px" }}
          >
            <div className="text-[8px] font-bold leading-relaxed" style={{ color: C.GREEN }}>
              ATIVO  {uptime}
            </div>
            <div className="text-[8px] leading-relaxed" style={{ color: C.TEXT_MED }}>
              PROC  {procCount}
            </div>
            <div className="text-[8px] leading-relaxed" style={{ color: C.ACC2 }}>
              SO  WEB
            </div>
          </div>

          <div className="flex-1" />

          <div
            className="text-center text-[7px] font-bold p-1 rounded-sm whitespace-pre-line"
            style={{ color: C.GREEN, background: C.PANEL2, border: `1px solid ${C.BORDER_A}` }}
          >
            {"NÚCLEO IA\nATIVO"}
          </div>
          <div
            className="text-center text-[7px] font-bold p-1 rounded-sm whitespace-pre-line"
            style={{ color: C.PRI, background: C.PANEL2, border: `1px solid ${C.BORDER_A}` }}
          >
            {"SEG\nLIBERADA"}
          </div>
          <div
            className="text-center text-[7px] font-bold p-1 rounded-sm whitespace-pre-line"
            style={{ color: C.TEXT_DIM, background: C.PANEL2, border: `1px solid ${C.BORDER_A}` }}
          >
            {"NOWGO\nAI"}
          </div>
        </aside>

        {/* DF BRIEFING (segundo painel lateral, mais largo) */}
        <aside
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{
            width: "260px",
            background: C.DARK,
            borderRight: `1px solid ${C.BORDER}`,
            padding: "8px",
            gap: "8px",
          }}
        >
          <DfBriefingPanel topic="geral" region="DF" refreshMs={15 * 60 * 1000} />
        </aside>

        {/* CENTER */}
        <main className="flex-1 min-w-0 min-h-0 relative">
          <HudCanvas state={hudState} muted={muted} />
        </main>

        {/* RIGHT PANEL */}
        <aside
          className="flex flex-col shrink-0 overflow-hidden"
          style={{
            width: "340px",
            background: C.DARK,
            borderLeft: `1px solid ${C.BORDER}`,
            padding: "8px",
            gap: "6px",
          }}
        >
          <div className="text-[7px] font-bold" style={{ color: C.TEXT_MED }}>
            ▸ REGISTRO DE ATIVIDADE
          </div>
          <LogWidget logs={logs} />

          <div className="shrink-0" style={{ height: "1px", background: C.BORDER, margin: "2px 0" }} />

          <div className="text-[7px] font-bold" style={{ color: C.TEXT_MED }}>
            ▸ ENVIAR ARQUIVO
          </div>
          <FileDropZone
            onFileSelected={handleFileSelected}
            currentFile={currentFile}
            onClear={handleFileClear}
          />
          <div className="text-[7px]" style={{ color: C.TEXT_MED }}>
            {currentFile
              ? `Diga ao XAVIER o que fazer com ${currentFile.name}`
              : "Nenhum arquivo carregado — arraste ou clique acima"}
          </div>

          <div className="shrink-0" style={{ height: "1px", background: C.BORDER, margin: "2px 0" }} />

          <div className="text-[7px] font-bold" style={{ color: C.TEXT_MED }}>
            ▸ COMANDO
          </div>
          <div className="flex gap-1.5 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Digite um comando ou pergunta…"
              className="flex-1 h-[30px] px-2 text-[9px] rounded-sm outline-none transition-colors"
              style={{
                background: "#000d14",
                color: C.WHITE,
                border: `1px solid ${C.BORDER}`,
                fontFamily: "'JetBrains Mono', monospace",
              }}
              onFocus={(e) => (e.target.style.borderColor = C.PRI)}
              onBlur={(e) => (e.target.style.borderColor = C.BORDER)}
            />
            <button
              onClick={handleSend}
              className="w-[30px] h-[30px] text-[11px] font-bold rounded-sm shrink-0 transition-all hover:brightness-125"
              style={{
                background: C.PANEL,
                color: C.PRI,
                border: `1px solid ${C.PRI_DIM}`,
              }}
            >
              ▸
            </button>
          </div>

          <button
            onClick={toggleMute}
            className="h-[30px] text-[8px] font-bold rounded-sm transition-all shrink-0"
            style={{
              background: muted ? "#140006" : "#00140a",
              color: muted ? C.MUTED_C : C.GREEN,
              border: `1px solid ${muted ? C.MUTED_C : C.GREEN}`,
            }}
          >
            {muted ? "🔇  MICROFONE SILENCIADO" : "🎙  MICROFONE ATIVO"}
          </button>

          <button
            onClick={toggleFullscreen}
            className="h-[26px] text-[7px] rounded-sm transition-all shrink-0"
            style={{
              background: "transparent",
              color: C.TEXT_MED,
              border: `1px solid ${C.BORDER}`,
            }}
          >
            ⛶  TELA CHEIA  [F11]
          </button>
        </aside>
      </div>

      {/* FOOTER */}
      <footer
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: "22px",
          background: C.DARK,
          borderTop: `1px solid ${C.BORDER}`,
        }}
      >
        <span className="text-[7px]" style={{ color: C.TEXT_MED }}>
          [F4] Silenciar  ·  [F11] Tela Cheia
        </span>
        <span className="text-[7px]" style={{ color: C.TEXT_MED }}>
          NOWGO AI  ·  CONFIDENCIAL
        </span>
        <span className="text-[7px]" style={{ color: C.PRI_DIM }}>
          POWERED BY NOWGO AI
        </span>
      </footer>

      {/* Setup Overlay */}
      {showSetup && <SetupOverlay onDone={handleSetupDone} />}
    </div>
  );
}
