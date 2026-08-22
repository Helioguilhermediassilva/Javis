import { describe, expect, it } from "vitest";
import { creditBlockedMessage, creditLowBalanceMessage, estimateXavierCreditUnits, getXavierCreditsUrl } from "./xavierCredits.js";
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
  it("estima mais unidades para apresentação visual do que para texto simples", () => {
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Criar apresentação", metadata: {} })).toBe(120);
    expect(estimateXavierCreditUnits({ kind: "presentation", requestText: "Adicionar imagens", metadata: { visual_presentation: true, image_count: 3 } })).toBe(1700);
  });

  it("produz mensagem acionável quando a franquia é insuficiente", () => {
    const message = creditBlockedMessage(action({ metadata: { credit_blocked: true, credit_required_units: 1700, credit_available_units: 100 } }));
    expect(message).toContain("1.700 créditos");
    expect(message).toContain("100 disponíveis");
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
