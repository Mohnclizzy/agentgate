export interface RedactionOptions {
  secretKeyPattern?: RegExp;
}

const OPENAI_KEY_PATTERN = /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}\b/g;
const GITHUB_TOKEN_PATTERN = /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+([A-Za-z0-9._~+/=-]{20,})\b/g;
const DEFAULT_SECRET_KEY_PATTERN = /(?:password|passwd|secret|token|api[_-]?key|authorization|credential)/i;

export function redactText(text: string): string {
  return text
    .replace(OPENAI_KEY_PATTERN, "[REDACTED:openai-key]")
    .replace(GITHUB_TOKEN_PATTERN, "[REDACTED:github-token]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED:bearer-token]");
}

export function redactValue<T>(value: T, options: RedactionOptions = {}): T {
  return redactUnknown(value, options) as T;
}

function redactUnknown(value: unknown, options: RedactionOptions): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, options));
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    const keyPattern = options.secretKeyPattern ?? DEFAULT_SECRET_KEY_PATTERN;

    for (const [key, nestedValue] of Object.entries(value)) {
      if (keyPattern.test(key)) {
        redacted[key] = `[REDACTED:${key}]`;
      } else {
        redacted[key] = redactUnknown(nestedValue, options);
      }
    }

    return redacted;
  }

  return value;
}
