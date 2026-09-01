import { describe, expect, it } from "vitest";
import { generateLinkCode } from "@/lib/link-codes";

describe("generateLinkCode", () => {
  it("returns codes matching the EDU-XXXX-XX format", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).toMatch(/^EDU-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    }
  });

  it("never includes ambiguous characters (I, O, 0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it("generates distinct codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateLinkCode()));
    expect(codes.size).toBe(200);
  });
});