import { describe, expect, it } from "vitest";
import {
  approvalReference,
  classifyXavierTaskRequest,
  isXavierApprovalCommand,
  isXavierCancellationCommand,
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
});
