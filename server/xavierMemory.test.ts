import { describe, expect, it } from "vitest";
import { buildXavierRollingSummary } from "./xavierMemory";

describe("Xavier rolling memory summary", () => {
  it("combina resumo anterior e turnos recentes em texto limitado", () => {
    const result = buildXavierRollingSummary("Usuário prefere respostas curtas.", [
      { role: "user", content: "Meu canal principal é Telegram." },
      { role: "assistant", content: "Registrado, senhor." },
    ]);
    expect(result).toContain("Resumo acumulado anterior:");
    expect(result).toContain("Meu canal principal é Telegram.");
    expect(result.length).toBeLessThanOrEqual(6000);
  });

  it("não gera conteúdo quando não há mensagens novas", () => {
    expect(buildXavierRollingSummary(null, [])).toBe("Resumo acumulado da conversa:");
  });
});
