import { useEffect, useRef } from "react";

// Color constants matching the original
const C = {
  BG: "#00060a",
  PRI: "#00d4ff",
  PRI_DIM: "#007a99",
  PRI_GHO: "#001f2e",
  ACC: "#ff6b00",
  ACC2: "#ffcc00",
  GREEN: "#00ff88",
  MUTED_C: "#ff3366",
  BORDER_B: "#1a5c7a",
};

export type HudState = "INITIALISING" | "LISTENING" | "SPEAKING" | "THINKING" | "PROCESSING" | "MUTED";

interface HudCanvasProps {
  state: HudState;
  muted: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function HudCanvas({ state, muted }: HudCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({ state, muted });

  // Animation state
  const anim = useRef({
    tick: 0,
    scale: 1.0,
    tgtScale: 1.0,
    halo: 55.0,
    tgtHalo: 55.0,
    lastT: Date.now(),
    scan: 0.0,
    scan2: 180.0,
    rings: [0.0, 120.0, 240.0],
    pulses: [0.0, 50.0, 100.0] as number[],
    blink: true,
    blinkTick: 0,
    particles: [] as number[][],
  });

  useEffect(() => {
    stateRef.current = { state, muted };
  }, [state, muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = parent.clientWidth * dpr;
        canvas.height = parent.clientHeight * dpr;
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
      }
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { state: curState, muted: curMuted } = stateRef.current;
      const speaking = curState === "SPEAKING";
      const a = anim.current;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const fw = Math.min(W, H);

      // Update animation state
      a.tick += 1;
      const now = Date.now();
      const threshold = speaking ? 120 : 500;
      if (now - a.lastT > threshold) {
        if (speaking) {
          a.tgtScale = 1.06 + Math.random() * 0.08;
          a.tgtHalo = 145 + Math.random() * 45;
        } else if (curMuted) {
          a.tgtScale = 0.998 + Math.random() * 0.004;
          a.tgtHalo = 15 + Math.random() * 13;
        } else {
          a.tgtScale = 1.001 + Math.random() * 0.007;
          a.tgtHalo = 48 + Math.random() * 20;
        }
        a.lastT = now;
      }

      const sp = speaking ? 0.38 : 0.15;
      a.scale += (a.tgtScale - a.scale) * sp;
      a.halo += (a.tgtHalo - a.halo) * sp;

      const speeds = speaking ? [1.3, -0.9, 2.0] : [0.55, -0.35, 0.9];
      for (let i = 0; i < 3; i++) {
        a.rings[i] = (a.rings[i] + speeds[i] + 360) % 360;
      }

      a.scan = (a.scan + (speaking ? 3.0 : 1.3)) % 360;
      a.scan2 = (a.scan2 + (speaking ? -2.0 : -0.75) + 360) % 360;

      const lim = fw * 0.74;
      const pulseSpd = speaking ? 4.2 : 2.0;
      a.pulses = a.pulses.map((r) => r + pulseSpd).filter((r) => r < lim);
      if (a.pulses.length < 3 && Math.random() < (speaking ? 0.07 : 0.025)) {
        a.pulses.push(0.0);
      }

      // Particles
      if (speaking && Math.random() < 0.28) {
        const ang = Math.random() * 2 * Math.PI;
        const rS = fw * 0.28;
        a.particles.push([
          cx + Math.cos(ang) * rS,
          cy + Math.sin(ang) * rS,
          Math.cos(ang) * (0.9 + Math.random() * 1.5),
          Math.sin(ang) * (0.9 + Math.random() * 1.5) - 0.4,
          1.0,
        ]);
      }
      a.particles = a.particles
        .map((p) => [p[0] + p[2], p[1] + p[3], p[2] * 0.97, p[3] * 0.97, p[4] - 0.028])
        .filter((p) => p[4] > 0);

      a.blinkTick += 1;
      if (a.blinkTick >= 38) {
        a.blink = !a.blink;
        a.blinkTick = 0;
      }

      // --- DRAW ---
      ctx.fillStyle = C.BG;
      ctx.fillRect(0, 0, W, H);

      // Grid dots
      ctx.fillStyle = hexToRgba(C.PRI_GHO, 1);
      const gridStep = 48 * dpr;
      for (let x = 0; x < W; x += gridStep) {
        for (let y = 0; y < H; y += gridStep) {
          ctx.fillRect(x, y, dpr, dpr);
        }
      }

      const rFace = fw * 0.31;
      const halo = a.halo;
      const mainCol = curMuted ? C.MUTED_C : C.PRI;

      // Halo glow
      for (let i = 0; i < 10; i++) {
        const r = rFace * (1.8 - i * 0.08);
        const frc = 1.0 - i / 10;
        const al = Math.max(0, Math.min(1, (halo * 0.085 * frc) / 255));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(mainCol, al);
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }

      // Pulse rings
      for (const pr of a.pulses) {
        const al = Math.max(0, Math.min(1, (230 * (1.0 - pr / (fw * 0.74))) / 255));
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(mainCol, al);
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }

      // Spinning arc rings
      const ringParams: [number, number, number, number][] = [
        [0.48, 3, 115, 78],
        [0.40, 2, 78, 55],
        [0.32, 1, 56, 40],
      ];
      for (let idx = 0; idx < ringParams.length; idx++) {
        const [rFrac, wR, arcL, gap] = ringParams[idx];
        const ringR = fw * rFrac;
        const base = a.rings[idx];
        const aVal = Math.max(0, Math.min(1, (halo * (1.0 - idx * 0.18)) / 255));
        ctx.strokeStyle = hexToRgba(mainCol, aVal);
        ctx.lineWidth = wR * dpr;
        let angle = base;
        while (angle < base + 360) {
          const startRad = (angle * Math.PI) / 180;
          const endRad = ((angle + arcL) * Math.PI) / 180;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, startRad, endRad);
          ctx.stroke();
          angle += arcL + gap;
        }
      }

      // Scanners
      const sr = fw * 0.5;
      const sa = Math.min(1, (halo * 1.5) / 255);
      const ex = speaking ? 75 : 44;
      ctx.strokeStyle = hexToRgba(mainCol, sa);
      ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, (a.scan * Math.PI) / 180, ((a.scan + ex) * Math.PI) / 180);
      ctx.stroke();

      ctx.strokeStyle = hexToRgba(C.ACC, sa / 2);
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, (a.scan2 * Math.PI) / 180, ((a.scan2 + ex) * Math.PI) / 180);
      ctx.stroke();

      // Tick marks
      const tOut = fw * 0.497;
      const tIn = fw * 0.474;
      ctx.strokeStyle = hexToRgba(C.PRI, 140 / 255);
      ctx.lineWidth = 1 * dpr;
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const inn = deg % 30 === 0 ? tIn : tIn + 6 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + tOut * Math.cos(rad), cy - tOut * Math.sin(rad));
        ctx.lineTo(cx + inn * Math.cos(rad), cy - inn * Math.sin(rad));
        ctx.stroke();
      }

      // Crosshair
      const chR = fw * 0.51;
      const gapH = fw * 0.16;
      ctx.strokeStyle = hexToRgba(C.PRI, Math.min(1, (halo * 0.5) / 255));
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(cx - chR, cy); ctx.lineTo(cx - gapH, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + gapH, cy); ctx.lineTo(cx + chR, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - chR); ctx.lineTo(cx, cy - gapH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + gapH); ctx.lineTo(cx, cy + chR); ctx.stroke();

      // Corner brackets
      const bl = 24 * dpr;
      const hl = cx - fw / 2;
      const hr = cx + fw / 2;
      const ht = cy - fw / 2;
      const hb = cy + fw / 2;
      ctx.strokeStyle = hexToRgba(C.PRI, 210 / 255);
      ctx.lineWidth = 2 * dpr;
      const corners: [number, number, number, number][] = [
        [hl, ht, 1, 1], [hr, ht, -1, 1], [hl, hb, 1, -1], [hr, hb, -1, -1],
      ];
      for (const [bx, by, dx, dy] of corners) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dx * bl, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + dy * bl); ctx.stroke();
      }

      // Central orb
      const orbR = fw * 0.27 * a.scale;
      const oc = curMuted ? [200, 0, 50] : [0, 60, 110];
      for (let i = 8; i > 0; i--) {
        const r2 = orbR * (i / 8);
        const frc = i / 8;
        const al = Math.max(0, Math.min(1, (halo * 1.1 * frc) / 255));
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.floor(oc[0] * frc)},${Math.floor(oc[1] * frc)},${Math.floor(oc[2] * frc)},${al})`;
        ctx.fill();
      }

      // Xavier text in center
      const textAlpha = Math.min(1, (halo * 2) / 255);
      ctx.fillStyle = hexToRgba(C.PRI, textAlpha);
      ctx.font = `bold ${13 * dpr}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("XAVIER", cx, cy);

      // Particles
      for (const pt of a.particles) {
        const al = Math.max(0, Math.min(1, pt[4]));
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(C.PRI, al);
        ctx.fill();
      }

      // Status text
      const sy = cy + fw * 0.40;
      let statusText: string;
      let statusCol: string;
      if (curMuted) {
        statusText = "\u2298  SILENCIADO";
        statusCol = C.MUTED_C;
      } else if (speaking) {
        statusText = "\u25CF  FALANDO";
        statusCol = C.ACC;
      } else if (curState === "THINKING") {
        statusText = `${a.blink ? "\u25C8" : "\u25C7"}  PENSANDO`;
        statusCol = C.ACC2;
      } else if (curState === "PROCESSING") {
        statusText = `${a.blink ? "\u25B7" : "\u25B6"}  PROCESSANDO`;
        statusCol = C.ACC2;
      } else if (curState === "LISTENING") {
        statusText = `${a.blink ? "\u25CF" : "\u25CB"}  OUVINDO`;
        statusCol = C.GREEN;
      } else {
        statusText = `${a.blink ? "\u25CF" : "\u25CB"}  ${curState}`;
        statusCol = C.PRI;
      }

      ctx.fillStyle = statusCol;
      ctx.font = `bold ${11 * dpr}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(statusText, cx, sy);

      // Waveform
      const wy = sy + 30 * dpr;
      const N = 36;
      const bw = 8 * dpr;
      const wx0 = (W - N * bw) / 2;
      for (let i = 0; i < N; i++) {
        let hgt: number;
        let cl: string;
        if (curMuted) {
          hgt = 2 * dpr;
          cl = C.MUTED_C;
        } else if (speaking) {
          hgt = (3 + Math.floor(Math.random() * 17)) * dpr;
          cl = hgt > 12 * dpr ? C.PRI : C.PRI_DIM;
        } else {
          hgt = Math.floor((3 + 2 * Math.sin(a.tick * 0.09 + i * 0.6)) * dpr);
          cl = C.BORDER_B;
        }
        ctx.fillStyle = cl;
        ctx.fillRect(wx0 + i * bw, wy + 20 * dpr - hgt, bw - dpr, hgt);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: C.BG }}
    />
  );
}
