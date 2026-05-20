import { describe, it, expect } from "vitest";

/**
 * Validates that ELEVENLABS_API_KEY is present and authenticates against the
 * ElevenLabs API. We use the lightweight /v1/voices endpoint (no audio
 * synthesis cost) and assert that:
 *   - the request succeeds (HTTP 200)
 *   - the response body lists at least one voice
 *   - the cloned "Hélio Guilherme" voice (used as JARVIS default) is reachable
 */
describe("ELEVENLABS_API_KEY secret", () => {
  it("authenticates against ElevenLabs and exposes the cloned JARVIS voice", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey, "ELEVENLABS_API_KEY must be set").toBeTruthy();

    const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey as string },
    });
    expect(
      resp.status,
      `Expected 200 from /v1/voices, got ${resp.status} ${resp.statusText}`,
    ).toBe(200);

    const data = (await resp.json()) as { voices?: Array<{ voice_id: string; name: string }> };
    expect(Array.isArray(data.voices)).toBe(true);
    expect((data.voices || []).length).toBeGreaterThan(0);

    // The default JARVIS voice we ship in production must be reachable.
    const DEFAULT_VOICE_ID = "F1W6zKJWyDQD3yKJc4A6"; // Hélio Guilherme (cloned)
    const found = (data.voices || []).find((v) => v.voice_id === DEFAULT_VOICE_ID);
    expect(found, `Voice ${DEFAULT_VOICE_ID} not found in account`).toBeTruthy();
  }, 15000);
});
