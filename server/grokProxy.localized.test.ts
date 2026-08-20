import { describe, expect, it } from "vitest";
import {
  buildSentimentSystemPrompt,
  getCachedSentiment,
  setCachedSentiment,
  type SentimentLocation,
} from "./grokProxy";

describe("localized social briefing", () => {
  const location: SentimentLocation = {
    country: "Brasil",
    state: "São Paulo",
    city: "Campinas",
  };

  it("builds the social prompt in the selected language and location", () => {
    const portuguese = buildSentimentSystemPrompt("pt", location);
    const english = buildSentimentSystemPrompt("en", location);
    const spanish = buildSentimentSystemPrompt("es", location);

    expect(portuguese).toContain("Campinas, São Paulo, Brasil");
    expect(portuguese).toContain("Brazilian Portuguese");
    expect(english).toContain("Campinas, São Paulo, Brasil");
    expect(english).toContain("English");
    expect(spanish).toContain("Campinas, São Paulo, Brasil");
    expect(spanish).toContain("Spanish");
  });

  it("keeps cache entries isolated by locale and location", () => {
    const topic = `cache-test-${Date.now()}`;
    const region = "Campinas";
    const otherLocation: SentimentLocation = { ...location, city: "Santos" };
    const portugueseResult = { summary: "Resumo em português" };
    const englishResult = { summary: "Summary in English" };

    setCachedSentiment(topic, region, portugueseResult, "pt", location);
    setCachedSentiment(topic, region, englishResult, "en", location);

    expect(getCachedSentiment(topic, region, "pt", location)).toEqual(portugueseResult);
    expect(getCachedSentiment(topic, region, "en", location)).toEqual(englishResult);
    expect(getCachedSentiment(topic, region, "pt", otherLocation)).toBeNull();
  });
});
