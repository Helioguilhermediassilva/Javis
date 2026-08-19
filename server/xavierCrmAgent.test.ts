import { describe, expect, it } from "vitest";
import { detectXavierCrmRequest, parseXavierCrmIntent } from "./xavierCrmAgent.js";

describe("xavier CRM agent", () => {
  it("reconhece criação de contato com dados naturais", () => {
    const intent = parseXavierCrmIntent("Adicione o contato João Silva, joao@empresa.com, telefone (61) 99999-0000, empresa NowGo");
    expect(detectXavierCrmRequest("Adicione o contato João Silva, joao@empresa.com")).toBe(true);
    expect(intent.action).toBe("create");
    expect(intent.entity).toBe("contact");
    expect(intent.fields.name).toContain("João Silva");
    expect(intent.fields.email).toBe("joao@empresa.com");
    expect(intent.fields.phone).toContain("99999-0000");
  });

  it("reconhece criação de demanda com prazo, prioridade e contato", () => {
    const intent = parseXavierCrmIntent("Registre uma demanda: preparar proposta comercial, prazo 20/08/2026, prioridade alta, contato: João Silva");
    expect(intent.action).toBe("create");
    expect(intent.entity).toBe("demand");
    expect(intent.fields.title).toContain("preparar proposta comercial");
    expect(intent.fields.due_date).toBe("2026-08-20");
    expect(intent.fields.priority).toBe("high");
    expect(intent.fields.contact_name).toBe("João Silva");
  });

  it("reconhece anotações implícitas sem a palavra anotação", () => {
    const text = "Anote que o cliente prefere receber a proposta na próxima semana";
    const intent = parseXavierCrmIntent(text);
    expect(detectXavierCrmRequest(text)).toBe(true);
    expect(intent.action).toBe("create");
    expect(intent.entity).toBe("note");
    expect(String(intent.fields.content)).toContain("cliente prefere receber");
  });

  it("reconhece listagem e atualização sem confundir conversa comum", () => {
    expect(parseXavierCrmIntent("Liste minhas demandas pendentes").action).toBe("list");
    expect(parseXavierCrmIntent("Atualize a demanda preparar proposta para concluída").action).toBe("update");
    expect(detectXavierCrmRequest("Explique como priorizar meu trabalho")).toBe(false);
  });
});
