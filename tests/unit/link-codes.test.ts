import { describe, expect, it } from "vitest";
import {
  generateLinkCode,
  generateCodeSalt,
  hashLinkCode,
  isValidLinkCode,
  LINK_CODE_REGEX,
  normalizeLinkCode,
} from "@/lib/link-codes";

describe("generateLinkCode", () => {
  it("returns codes matching the EDU-XXXX-XXXX format", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).toMatch(/^EDU-[A-Z1-9]{4}-[A-Z1-9]{4}$/);
    }
  });

  it("never includes ambiguous characters (I, O, 0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it("generates distinct codes", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateLinkCode())
    );
    expect(codes.size).toBe(200);
  });
});

describe("isValidLinkCode / normalizeLinkCode", () => {
  it("accepts generated codes and tolerates case/whitespace", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLinkCode();
      expect(isValidLinkCode(code)).toBe(true);
      expect(isValidLinkCode(`  ${code.toLowerCase()}  `)).toBe(true);
      expect(normalizeLinkCode(`  ${code.toLowerCase()}  `)).toBe(code);
    }
  });

  it("rejects malformed codes", () => {
    expect(isValidLinkCode("")).toBe(false);
    expect(isValidLinkCode("EDU-ABCD")).toBe(false);
    expect(isValidLinkCode("EDU-ABCD-ABCD-ABCD")).toBe(false);
    expect(isValidLinkCode("EDU-ABCD-123")).toBe(false);
    expect(isValidLinkCode("EDU-ABCD-ABC1-AB")).toBe(false);
    expect(isValidLinkCode("EDU-XYZ1-AAA")).toBe(false);
  });

  it("exposes a regex that matches the documented format", () => {
    expect(LINK_CODE_REGEX).toBeInstanceOf(RegExp);
    expect(LINK_CODE_REGEX.test("EDU-V7KB-9Q2P")).toBe(true);
  });
});

describe("hashLinkCode", () => {
  it("is deterministic for the same salt + code", () => {
    const salt = generateCodeSalt();
    const a = hashLinkCode("EDU-V7KB-9Q2P", salt);
    const b = hashLinkCode("edu-v7kb-9q2p", salt);
    expect(a).toBe(b);
  });

  it("differs with a different salt", () => {
    const code = "EDU-V7KB-9Q2P";
    expect(hashLinkCode(code, generateCodeSalt())).not.toBe(
      hashLinkCode(code, generateCodeSalt())
    );
  });

  it("returns a 64 hex chars sha256 digest", () => {
    expect(hashLinkCode("EDU-V7KB-9Q2P", generateCodeSalt())).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  it("generates a hex salt of 32 chars (16 random bytes)", () => {
    expect(generateCodeSalt()).toMatch(/^[0-9a-f]{32}$/);
  });
});