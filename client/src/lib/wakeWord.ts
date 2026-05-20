// Detecção de wake-word "JARVIS" em transcrições do navegador (Web Speech API).
//
// Por que client-side puro:
// - O Web Speech API já entrega frases reconhecidas em pt-BR. Para wake-word
//   basta inspecionar o início da frase. Não precisamos de modelo dedicado tipo
//   Porcupine; ganho de privacidade (nada sai do dispositivo até bater).
//
// Por que normalização agressiva:
// - O reconhecedor do Chrome em pt-BR varia muito a forma como escreve "Jarvis":
//   "Jarvis", "jarvis", "Jarves", "Jarves,", "jarves", "geralves" (sic), até
//   "já vi" em situações ruins. Aceitamos um conjunto razoável de variantes
//   plausíveis e exigimos um prefixo curto ("ei", "olá", "oi") OPCIONAL.
//
// API:
//   matchWakeWord("Ei JARVIS, abra o briefing de saúde")
//     → { matched: true, command: "abra o briefing de saúde" }
//   matchWakeWord("Ei JARVIS")
//     → { matched: true, command: "" }   // sem comando ainda — JARVIS responde "Senhor(a)?"
//   matchWakeWord("vamos almoçar")
//     → { matched: false }

const WAKE_VARIANTS = [
  "jarvis",
  "jarves",
  "jarvez",
  "jarviz",
  "jarbis",
  "geralves", // erro de STT comum em ambientes ruidosos
  "járves",
];

const OPTIONAL_PREFIXES = [
  "ei",
  "ai",
  "hey",
  "hei",
  "ola",
  "ola,",
  "oi",
  "olha",
  "escuta",
  "escuta,",
];

export interface WakeWordMatch {
  matched: boolean;
  /** O texto após o wake-word (pode ser vazio se a fala foi só "Ei JARVIS"). */
  command: string;
  /** Variante exata que casou (debug). */
  variant?: string;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(text: string): string {
  // Remove diacríticos e tudo que não for letra ASCII / dígito / aspa simples /
  // espaço. Como já fizemos stripDiacritics() antes, ação reduz a um regex ASCII
  // (sem flag /u, que requer alvo TS >= ES2018).
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchWakeWord(rawText: string): WakeWordMatch {
  const norm = normalize(rawText);
  if (!norm) return { matched: false, command: "" };
  const tokens = norm.split(" ");
  let i = 0;
  // Pula até 1 prefixo opcional ("ei", "olá", etc.)
  if (tokens.length > 0 && OPTIONAL_PREFIXES.includes(tokens[0])) {
    i = 1;
  }
  if (i >= tokens.length) return { matched: false, command: "" };
  const candidate = tokens[i];
  const variant = WAKE_VARIANTS.find((w) => candidate === w);
  if (!variant) {
    // Aceita também a variante "j a r v i s" (soletrada) ou "jarvis," com
    // pontuação (já tratada pelo regex de normalização).
    return { matched: false, command: "" };
  }
  // Comando = tudo após o wake-word (no texto ORIGINAL, preservando capitalização
  // e acentuação). Para isso, reaplicamos a busca no texto bruto via regex.
  const rxBuilder = new RegExp(
    `^\\s*(?:${OPTIONAL_PREFIXES.map(escapeRx).join("|")})?[\\s,]*(?:${WAKE_VARIANTS.map(escapeRx).join("|")})[\\s,.;:!?-]*`,
    "i",
  );
  const command = rawText.replace(rxBuilder, "").trim();
  return { matched: true, command, variant };
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Estado de "armado": após detectar wake-word sem comando, ficamos por
 * `windowMs` aceitando a próxima fala como comando. Útil para UX:
 *   Usuário: "Ei JARVIS"
 *   JARVIS:  "Senhora?"
 *   Usuário: "Mostre o briefing de saúde"   ← já cai como comando direto
 */
export class WakeWordArmedWindow {
  private armedUntil = 0;
  constructor(private readonly windowMs = 8000) {}
  arm(now: number = Date.now()): void {
    this.armedUntil = now + this.windowMs;
  }
  isArmed(now: number = Date.now()): boolean {
    return now < this.armedUntil;
  }
  disarm(): void {
    this.armedUntil = 0;
  }
}
