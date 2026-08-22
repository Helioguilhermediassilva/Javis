import { describe, expect, it } from "vitest";
import {
  approvalReference,
  getXavierActionReferenceFilter,
  classifyXavierTaskRequest,
  isXavierApprovalCommand,
  isXavierCancellationCommand,
  formatXavierActionFailure,
} from "./xavierTaskOrchestrator.js";

describe("Xavier task orchestrator", () => {
  it("mantém PDF local sem exigir aprovação externa", () => {
    const intent = classifyXavierTaskRequest("gere um PDF com o briefing da reunião");
    expect(intent).toMatchObject({ kind: "pdf", requiresApproval: false, execution: "local" });
  });

  it("encaminha imagem raster e vídeo ao provedor com aprovação", () => {
    expect(classifyXavierTaskRequest("crie uma imagem para a campanha")).toMatchObject({ kind: "image", requiresApproval: true, execution: "provider" });
    expect(classifyXavierTaskRequest("gere um vídeo institucional")).toMatchObject({ kind: "video", requiresApproval: true, execution: "provider" });
  });

  it("prioriza apresentação visual quando o pedido combina PPTX e imagens", () => {
    expect(classifyXavierTaskRequest("crie uma apresentação PPTX com imagens da campanha")).toMatchObject({ kind: "presentation", requiresApproval: true, execution: "provider" });
  });

  it("classifica sistemas e MCP como ações externas quando solicitado", () => {
    expect(classifyXavierTaskRequest("conecte o Xavier via MCP ao Notion")).toMatchObject({ kind: "mcp", requiresApproval: true, execution: "mcp" });
    expect(classifyXavierTaskRequest("crie um sistema do zero e publique")).toMatchObject({ kind: "system", requiresApproval: true, execution: "external" });
  });

  it("reconhece aprovação e cancelamento somente com referência explícita", () => {
    expect(isXavierApprovalCommand("aprovar XAV-ABC12345")).toBe(true);
    expect(isXavierCancellationCommand("cancelar XAV-ABC12345")).toBe(true);
    expect(approvalReference("aprovar XAV-ABC12345")).toBe("XAV-ABC12345");
    expect(isXavierApprovalCommand("aprovar tudo")).toBe(false);
  });

  it("resolve códigos XAV e UUIDs com filtros de coluna distintos", () => {
    expect(getXavierActionReferenceFilter("aprovar XAV-ABC12345")).toBeNull();
    expect(getXavierActionReferenceFilter(" XAV-ABC12345 ")).toEqual({ field: "approval_code", value: "XAV-ABC12345" });
    expect(getXavierActionReferenceFilter("39813673-0609-4d48-bed9-3006c96cdd77")).toEqual({ field: "id", value: "39813673-0609-4d48-bed9-3006c96cdd77" });
  });

  it("converte falhas conhecidas em mensagens acionáveis", () => {
    expect(formatXavierActionFailure(new Error("Runway 402: insufficient credits"))).toContain("saldo da API do Runway");
    expect(formatXavierActionFailure(new Error("Runway 429 rate limit"))).toContain("limite de solicitações");
    expect(formatXavierActionFailure(new Error("Runway 401 invalid API key"))).toContain("chave do Runway foi rejeitada");
    expect(formatXavierActionFailure(new Error("PPTX image format unsupported"))).toContain("compor ou armazenar a apresentação");
    expect(formatXavierActionFailure(new Error("Supabase storage upload 413: EntityTooLarge"))).toContain("capacidade do armazenamento precisará ser ampliada");
    expect(formatXavierActionFailure(new Error("Supabase storage upload 413: EntityTooLarge"))).not.toContain("EntityTooLarge");
  });
});
