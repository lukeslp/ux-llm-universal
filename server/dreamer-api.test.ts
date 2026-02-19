import { describe, expect, it } from "vitest";

describe("dr.eamer.dev API key validation", () => {
  it("should authenticate successfully with the DREAMER_API_KEY", async () => {
    const apiKey = process.env.DREAMER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.dr.eamer.dev/v1/capabilities", {
      headers: {
        "X-API-Key": apiKey!,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("utils");
    expect(data).toHaveProperty("llm");
  });

  it("should be able to list data sources", async () => {
    const apiKey = process.env.DREAMER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      "https://api.dr.eamer.dev/v1/data/sources",
      {
        headers: {
          "X-API-Key": apiKey!,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
  });
});
