import { describe, expect, it } from "vitest";

describe("Ollama Cloud API key validation", () => {
  it("should have OLLAMA_KEY_ID and OLLAMA_KEY_SECRET env vars set", () => {
    const keyId = process.env.OLLAMA_KEY_ID;
    const keySecret = process.env.OLLAMA_KEY_SECRET;
    expect(keyId).toBeTruthy();
    expect(keySecret).toBeTruthy();
    expect(keyId!.length).toBe(32);
    expect(keySecret!.length).toBeGreaterThanOrEqual(20);
  });

  it("should reconstruct a valid key and authenticate with Ollama Cloud", async () => {
    const keyId = process.env.OLLAMA_KEY_ID!;
    const keySecret = process.env.OLLAMA_KEY_SECRET!;
    const fullKey = `${keyId}.${keySecret}`;

    expect(fullKey.length).toBe(57); // 32 + 1 + 24

    const response = await fetch("https://ollama.com/api/tags", {
      headers: {
        Authorization: `Bearer ${fullKey}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("models");
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it("should have glm-5 model available", async () => {
    const keyId = process.env.OLLAMA_KEY_ID!;
    const keySecret = process.env.OLLAMA_KEY_SECRET!;
    const fullKey = `${keyId}.${keySecret}`;

    const response = await fetch("https://ollama.com/api/tags", {
      headers: {
        Authorization: `Bearer ${fullKey}`,
      },
    });

    const data = await response.json();
    const modelNames = data.models.map((m: any) => m.name);
    expect(modelNames).toContain("glm-5");
  });
});
