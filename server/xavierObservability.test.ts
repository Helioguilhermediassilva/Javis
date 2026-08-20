import { describe, expect, it } from "vitest";
import { getXavierRequestId, publicXavierError } from "./xavierObservability.js";

describe("xavierObservability", () => {
  it("mantém um request id confiável fornecido pelo cliente", () => {
    const id = getXavierRequestId({ headers: { "x-request-id": "web-user-123456" } } as never);
    expect(id).toBe("web-user-123456");
  });

  it("gera um request id quando o header é inválido", () => {
    const id = getXavierRequestId({ headers: { "x-request-id": "bad id" } } as never);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("não expõe detalhes de providers em falhas upstream", () => {
    const message = publicXavierError(502, "Upstream 401: Authorization Bearer secret-value");
    expect(message).toBe("O Xavier encontrou uma falha temporária. Tente novamente em alguns instantes.");
    expect(message).not.toContain("secret-value");
  });

  it("preserva mensagens de validação úteis para o usuário", () => {
    expect(publicXavierError(400, "userMessage or attachments required")).toBe("userMessage or attachments required");
    expect(publicXavierError(401, "Sessão inválida ou expirada")).toBe("Sessão inválida ou expirada");
  });
});
