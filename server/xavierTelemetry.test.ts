import { describe, expect, it } from "vitest";
import { buildXavierUsageEventRow } from "./xavierTelemetry.js";

describe("xavierTelemetry", () => {
  it("sanitiza o evento sem incluir conteúdo privado", () => {
    const row = buildXavierUsageEventRow({
      userId: "user-123",
      requestId: "request-456",
      channel: "web",
      eventName: "chat_response",
      status: "success",
      provider: "grok",
      model: "grok-4.3",
      latencyMs: 1234.6,
      inputTokens: 120,
      outputTokens: 80,
      metadata: {
        route: "/api/jarvis/chat",
        prompt: "não deve entrar na telemetria",
      },
    });

    expect(row).toMatchObject({
      user_id: "user-123",
      request_id: "request-456",
      channel: "web",
      event_name: "chat_response",
      status: "success",
      latency_ms: 1235,
      input_tokens: 120,
      output_tokens: 80,
    });
    expect((row.metadata as Record<string, unknown>).route).toBe("/api/jarvis/chat");
    expect((row.metadata as Record<string, unknown>).prompt).toBeUndefined();
  });

  it("limita metadados e normaliza valores numéricos inválidos", () => {
    const metadata = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`key-${index}`, index]));
    const row = buildXavierUsageEventRow({
      channel: "system",
      eventName: "provider_failure",
      latencyMs: -10,
      inputTokens: Number.POSITIVE_INFINITY,
      outputTokens: 9,
      estimatedCostUsd: 0.123456789,
      metadata,
    });

    expect(row.latency_ms).toBe(0);
    expect(row.input_tokens).toBeNull();
    expect(row.output_tokens).toBe(9);
    expect(row.estimated_cost_usd).toBe(0.12345679);
    expect(Object.keys(row.metadata as object)).toHaveLength(20);
  });
});
