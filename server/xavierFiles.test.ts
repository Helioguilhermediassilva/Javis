import { describe, expect, it } from "vitest";
import { isEditableXavierFile, isFileEditRequest, type XavierFileRecord } from "./xavierFiles.js";

function file(category: XavierFileRecord["category"], mimeType: string): XavierFileRecord {
  return {
    id: "file-1",
    user_id: "user-1",
    conversation_id: "conversation-1",
    parent_file_id: null,
    file_name: category === "pdf" ? "relatorio.pdf" : category === "image" ? "imagem.png" : category === "document" ? "documento.docx" : "notas.txt",
    storage_path: "xavier/user-1/web/conversation-1/file-1.bin",
    mime_type: mimeType,
    size_bytes: 100,
    category,
    status: "ready",
    version: 1,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
}

describe("Xavier session files", () => {
  it("detects edit commands in Portuguese, English, and Spanish", () => {
    expect(isFileEditRequest("Altere o título deste arquivo", true)).toBe(true);
    expect(isFileEditRequest("Please edit this document", true)).toBe(true);
    expect(isFileEditRequest("Edita el resumen del archivo", true)).toBe(true);
  });

  it("does not edit without an active file", () => {
    expect(isFileEditRequest("Altere o título deste arquivo", false)).toBe(false);
  });

  it("allows text and PDF editing but does not pretend binary formats are editable", () => {
    expect(isEditableXavierFile(file("text", "text/plain"))).toBe(true);
    expect(isEditableXavierFile(file("pdf", "application/pdf"))).toBe(true);
    expect(isEditableXavierFile(file("image", "image/png"))).toBe(false);
    expect(isEditableXavierFile(file("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe(false);
  });
});
