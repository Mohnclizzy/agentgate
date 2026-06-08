import { describe, expect, test } from "vitest";
import { redactText, redactValue } from "../src/redaction.js";

describe("redactText", () => {
  test("masks common API key and bearer token shapes", () => {
    const text = "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 bearer Bearer abcdefghijklmnopqrstuvwxyz123456";

    expect(redactText(text)).toBe(
      "OPENAI_API_KEY=[REDACTED:openai-key] bearer Bearer [REDACTED:bearer-token]"
    );
  });
});

describe("redactValue", () => {
  test("recursively redacts secret-looking object keys", () => {
    const value = {
      ok: "visible",
      password: "hunter2",
      nested: {
        githubToken: "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
      }
    };

    expect(redactValue(value)).toEqual({
      ok: "visible",
      password: "[REDACTED:password]",
      nested: {
        githubToken: "[REDACTED:githubToken]"
      }
    });
  });

  test("does not mutate the original value", () => {
    const value = { secret: "abc123", other: ["sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"] };

    redactValue(value);

    expect(value).toEqual({
      secret: "abc123",
      other: ["sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"]
    });
  });
});
