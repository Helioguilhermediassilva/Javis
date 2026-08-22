import { describe, expect, it } from "vitest";
import { creditBlockedMessage, creditLowBalanceMessage, estimateXavierCreditUnits, getXavierCreditsUrl } from "./xavierCredits.js";
import { deriveXavierActionMetadata } from "./xavierTaskOrchestrator.js";
import type { XavierActionRequest } from "./xavierTaskOrchestrator.js";

function action(overrides: Partial<XavierActionRequest> = {}): XavierActionRequest {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000002",
    channel: "telegram",
    conversation_id: null,
    telegram_connection_id: null,
    telegram_chat_id: "1",
    kind: "presentation",
    title: "Apresentação visual",
    request_text: "Adicionar imagens",
    status: "pending_approval",
    approval_code: "XAV-12345678",
    metadata: {},
    result_text: null,
    attachments: [],
    error_message: null,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
    approved_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe("xavierCredits", () => {
  it("aplica a política v3 para apresentação nova e refinamento visual", () => {
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Criar apresentação", metadata: {} })).toBe(8);
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Adicionar imagens", metadata: { visual_presentation: true, image_count: 3 } })).toBe(30);
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Refinar apresentação", metadata: { visual_presentation: true, image_count: 3, refinement: true } })).toBe(20);
  });

  it("deriva refinamento e imagens novas de um pedido natural", () => {
    const metadata = deriveXavierActionMetadata("Agora adicione algumas imagens e deixe a apresentação mais elaborada", {}, "presentation");
    expect(metadata.visual_presentation).toBe(true);
    expect(metadata.refinement).toBe(true);
    expect(metadata.new_image_count).toBe(3);
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Agora adicione algumas imagens e deixe a apresentação mais elaborada", metadata })).toBe(20);
  });

  it("mantém custos pequenos para arquivos e mídia curta", () => {
    expect(estimateXavierCreditUnits({ kind: "document", requestText: "Criar documento", metadata: {} })).toBe(4);
    expect(estimateXavierCreditUnits({ kind: "pdf", requestText: "Criar PDF", metadata: {} })).toBe(4);
    expect(estimateXavierCreditUnits({ kind: "spreadsheet", requestText: "Criar planilha", metadata: {} })).toBe(5);
    expect(estimateXavierCreditUnits({ kind: "image", requestText: "Criar imagem", metadata: {} })).toBe(8);
    expect(estimateXavierCreditUnits({ kind: "video", requestText: "Criar vídeo", metadata: { duration_seconds: 5 } })).toBe(40);
    expect(estimateXavierCreditUnits({ kind: "video", requestText: "Criar vídeo", metadata: { duration_seconds: 10 } })).toBe(65);
  });

  it("produz mensagem acionável quando a franquia é insuficiente", () => {
    const message = creditBlockedMessage(action({ metadata: { credit_blocked: true, credit_required_units: 30, credit_available_units: 10 } }));
    expect(message).toContain("30 créditos");
    expect(message).toContain("10 disponíveis");
    expect(message).toContain("nowgoai.com");
  });

  it("mantém a mensagem de bloqueio acionável para qualquer reserva", () => {
    const message = creditBlockedMessage(action({ metadata: { credit_blocked: true, credit_required_units: 100, credit_available_units: 0 } }));
    expect(message).toContain("100 créditos");
    expect(message).toContain("0 disponíveis");
    expect(message).toContain("nowgoai.com");
  });

  it("só acrescenta alerta quando o saldo está baixo", () => {
    expect(creditLowBalanceMessage(action({ metadata: { credit_low_balance: false } }))).toBe("");
    expect(creditLowBalanceMessage(action({ metadata: { credit_low_balance: true, credit_available_after: 80 } }))).toContain("80 créditos");
  });

  it("não aceita URL de créditos sem HTTPS", () => {
    expect(getXavierCreditsUrl()).toMatch(/^https:\/\//);
  });
});
