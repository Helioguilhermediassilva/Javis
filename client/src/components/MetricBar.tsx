import { useEffect, useRef } from "react";

const C = {
  PANEL2: "#010f18",
  BORDER_A: "#0f4060",
  BAR_BG: "#011520",
  TEXT_DIM: "#3a8a9a",
  RED: "#ff3355",
  ACC: "#ff6b00",
};

interface MetricBarProps {
  label: string;
  value: number; // 0-100
  text: string;
  color: string;
}

export default function MetricBar({ label, value, text, color }: MetricBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.PANEL2;
    ctx.strokeStyle = C.BORDER_A;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(1, 1, W - 2, H - 2, 4);
    ctx.fill();
    ctx.stroke();

    // Bar track
    const barH = 4;
    const barY = H - barH - 5;
    const barW = W - 12;
    const barX = 6;
    const fillW = (barW * Math.max(0, Math.min(100, value))) / 100;

    ctx.fillStyle = C.BAR_BG;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2);
    ctx.fill();

    // Bar fill
    let barCol = color;
    if (value > 85) barCol = C.RED;
    else if (value > 65) barCol = C.ACC;

    if (fillW > 0) {
      ctx.fillStyle = barCol;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 2);
      ctx.fill();
    }

    // Label
    ctx.font = "bold 7px 'JetBrains Mono', monospace";
    ctx.fillStyle = C.TEXT_DIM;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 8, 12);

    // Value text
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = text === "--" ? C.TEXT_DIM : barCol;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(text, W - 6, 12);
  }, [label, value, text, color]);

  return (
    <div className="w-full" style={{ height: "38px" }}>
      <canvas
        ref={canvasRef}
        height={38}
        className="w-full block"
        style={{ height: "38px" }}
      />
    </div>
  );
}
