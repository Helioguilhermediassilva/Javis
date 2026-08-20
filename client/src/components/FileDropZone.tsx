import { useState, useRef, useCallback } from "react";

const C = {
  PANEL: "#010d14",
  BORDER: "#0d3347",
  BORDER_B: "#1a5c7a",
  PRI: "#00d4ff",
  PRI_DIM: "#007a99",
  GREEN: "#00ff88",
  RED: "#ff3355",
  TEXT_DIM: "#3a8a9a",
  TEXT: "#8ffcff",
  WHITE: "#d8f8ff",
};

const EXT_TO_CAT: Record<string, string> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", bmp: "image", svg: "image",
  mp4: "video", avi: "video", mov: "video", mkv: "video", wmv: "video", webm: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", aac: "audio", flac: "audio",
  pdf: "pdf", doc: "word", docx: "word",
  xls: "excel", xlsx: "excel",
  ppt: "pptx", pptx: "pptx",
  py: "code", js: "code", ts: "code", jsx: "code", tsx: "code", html: "code", css: "code",
  java: "code", c: "code", cpp: "code", go: "code", rs: "code", rb: "code", php: "code",
  zip: "archive", rar: "archive", tar: "archive", gz: "archive",
  txt: "text", md: "text", log: "text",
  csv: "data", json: "data", xml: "data",
};

const FILE_ICONS: Record<string, [string, string]> = {
  image: ["🖼", "#00d4ff"],
  video: ["🎬", "#ff6b00"],
  audio: ["🎵", "#cc44ff"],
  pdf: ["📄", "#ff4444"],
  word: ["📝", "#4488ff"],
  excel: ["📊", "#44bb44"],
  code: ["💻", "#ffcc00"],
  archive: ["📦", "#ff8844"],
  pptx: ["📊", "#ff6622"],
  text: ["📃", "#aaaaaa"],
  data: ["🔧", "#88ddff"],
  unknown: ["📎", "#888888"],
};

function getCategory(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_CAT[ext] || "unknown";
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
  compact?: boolean;
}

export default function FileDropZone({ onFileSelected, currentFile, onClear, compact = false }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dashOffsetRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelected(files[0]);
    }
  }, [onFileSelected]);

  const handleClick = useCallback(() => {
    if (currentFile) return;
    inputRef.current?.click();
  }, [currentFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  }, [onFileSelected]);

  const borderColor = currentFile
    ? C.GREEN
    : dragOver
    ? C.PRI
    : hovering
    ? C.BORDER_B
    : C.BORDER;

  const bgColor = dragOver
    ? "#001a24"
    : hovering
    ? "#001218"
    : C.PANEL;

  return (
    <div
      className="relative w-full cursor-pointer select-none"
      style={{ height: compact ? "72px" : "100px" }}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className="w-full h-full flex items-center justify-center rounded-md p-1.5"
        style={{
          background: bgColor,
          border: `1.5px dashed ${borderColor}`,
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        {currentFile ? (
          <div className="flex items-center w-full h-full px-2 gap-3">
            <span className="text-2xl" style={{ color: FILE_ICONS[getCategory(currentFile.name)]?.[1] || "#888" }}>
              {FILE_ICONS[getCategory(currentFile.name)]?.[0] || "📎"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-bold truncate" style={{ color: C.WHITE }}>
                {currentFile.name}
              </div>
              <div className="text-[7px] mt-0.5" style={{ color: C.TEXT_DIM }}>
                {currentFile.name.split(".").pop()?.toUpperCase() || "FILE"} · {formatSize(currentFile.size)}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-sm font-bold hover:opacity-100 opacity-70 transition-opacity"
              style={{ color: C.RED }}
            >
              ✕
            </button>
          </div>
        ) : dragOver ? (
          <div className="text-center">
            <div className="text-xl" style={{ color: C.PRI }}>⬇</div>
            <div className="text-[8px] font-bold mt-1" style={{ color: C.PRI }}>
              Solte para carregar
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-sm mb-1" style={{ color: hovering ? C.PRI : C.PRI_DIM }}>
              ↑
            </div>
            <div className="text-[8px]" style={{ color: hovering ? C.TEXT : C.PRI_DIM }}>
              Arraste aqui  ou  clique para selecionar
            </div>
            <div className="text-[7px] mt-1" style={{ color: "#1a4a5a" }}>
              Imagens · Vídeo · Áudio · PDF · Documentos · Código · Dados
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
