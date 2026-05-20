import { describe, it, expect } from "vitest";

/**
 * Validates that XAI_API_KEY is present and authenticates against the xAI/Grok
 * API. We hit the lightweight /v1/models endpoint (no token cost) and assert
 * that the response is 200 and lists at least one Grok model.
 */
describe("XAI_API_KEY secret", () => {
  it("authenticates against xAI and lists at least one Grok model", async () => {
    const apiKey = process.env.XAI_API_KEY;
    expect(apiKey, "XAI_API_KEY must be set").toBeTruthy();

    const resp = await fetch("https://api.x.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey as string}` },
    });
    expect(
      resp.status,
      `Expected 200 from /v1/models, got ${resp.status} ${resp.statusText}`,
    ).toBe(200);

    const data = (await resp.json()) as { data?: Array<{ id: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data || []).length).toBeGreaterThan(0);

    const ids = (data.data || []).map((m) => m.id);
    const hasGrok = ids.some((id) => id.toLowerCase().includes("grok"));
    expect(hasGrok, `No Grok model found in account. Models: ${ids.join(", ")}`).toBe(true);
  }, 15000);
});
