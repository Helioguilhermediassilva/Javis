import { afterEach, describe, expect, it } from "vitest";
import {
  buildManusAcknowledgement,
  detectManusTaskRequest,
  routeManusTaskRequest,
} from "./xavierManus";

afterEach(() => {
  delete process.env.MANUS_API_KEY;
});

describe("Xavier Manus router", () => {
  it("encaminha comandos explícitos para Manus mesmo sem chave configurada", () => {
    const routed = routeManusTaskRequest("/manus pesquise as tendências de energia solar", "auto");
    expect(routed?.requestText).toContain("tendências de energia solar");
  });

  it("não tira mensagens normais do caminho Grok sem configuração Manus", () => {
    expect(routeManusTaskRequest("Qual é a previsão do tempo hoje?", "auto")).toBeNull();
    expect(routeManusTaskRequest("Faça uma pesquisa sobre o mercado", "auto")).toBeNull();
  });

  it("ativa o roteamento automático quando a chave Manus está configurada", () => {
    process.env.MANUS_API_KEY = "test-key";
    const routed = routeManusTaskRequest("Faça uma pesquisa sobre o mercado", "auto");
    expect(routed?.title).toBe("Execução profunda do Xavier");
  });

  it("respeita a escolha explícita de Grok", () => {
    process.env.MANUS_API_KEY = "test-key";
    expect(routeManusTaskRequest("/manus investigue o tema", "grok")).toBeNull();
  });

  it("detecta somente pedidos explícitos ou claramente profundos", () => {
    expect(detectManusTaskRequest("/deep: crie um relatório executivo")).toEqual({
      requestText: "crie um relatório executivo",
      title: "Tarefa profunda do Xavier",
    });
    expect(detectManusTaskRequest("Apenas me diga uma saudação")).toBeNull();
  });

  it("gera confirmação sem expor dados internos da tarefa", () => {
    const acknowledgement = buildManusAcknowledgement({
      id: "internal-id",
      user_id: "user-id",
      channel: "web",
      conversation_id: null,
      telegram_connection_id: null,
      telegram_chat_id: null,
      manus_task_id: "manus-id",
      task_url: "https://manus.im/app/task_manus-id",
      status: "running",
      request_text: "pesquisa",
      result_text: null,
      error_message: null,
      stop_reason: null,
      created_at: "2026-08-19T00:00:00Z",
      updated_at: "2026-08-19T00:00:00Z",
      completed_at: null,
      delivered_at: null,
    });
    expect(acknowledgement).toContain("Manus/SUN");
    expect(acknowledgement).toContain("task_manus-id");
    expect(acknowledgement).not.toContain("internal-id");
  });
});
