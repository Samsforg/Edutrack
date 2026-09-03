import { describe, expect, it } from "vitest";
import { StatisticalProvider } from "@/lib/ai/providers/statistical";
import { MockProvider } from "@/lib/ai/providers/mock";
import type { StudentRiskInput, ClassSummaryInput, StudentSummary, ClassSummary } from "@/lib/ai/types";
import { z } from "zod";

function makeStudentInput(over: Partial<StudentRiskInput> = {}): StudentRiskInput {
  return {
    schoolId: "sch-1",
    studentId: "stu-1",
    className: "6ème A",
    attendanceRatePct: 95,
    absenceRatePct: 5,
    lateCount: 0,
    lateDeltaPct: 0,
    lateRatePct: 0,
    currentAvg: 12,
    previousAvg: 12,
    classAvg: 12,
    trendDelta: 0,
    recentAvgDelta: 0,
    ...over,
  };
}

function makeClassInput(over: Partial<ClassSummaryInput> = {}): ClassSummaryInput {
  return {
    className: "6ème A",
    attendanceRatePct: 92,
    average: 13,
    top: [],
    concerns: [],
    ...over,
  };
}

function assertStudentSummary(res: StudentSummary | ClassSummary): asserts res is StudentSummary {
  if (!("overview" in res)) throw new Error("Not StudentSummary");
}
function assertClassSummary(res: StudentSummary | ClassSummary): asserts res is ClassSummary {
  if (!("className" in res)) throw new Error("Not ClassSummary");
}

describe("lib/ai/providers/statistical.ts", () => {
  const provider = new StatisticalProvider();

  it("nom = statistical", () => {
    expect(provider.name).toBe("statistical");
  });

  describe("generateSummary (student)", () => {
    it("retourne StudentSummary valide et déterministe", async () => {
      const input = makeStudentInput({ absenceRatePct: 10, currentAvg: 11 });
      const res = await provider.generateSummary({ kind: "student", data: input });
      assertStudentSummary(res);
      expect(typeof res.overview).toBe("string");
      expect(Array.isArray(res.strengths)).toBe(true);
      expect(Array.isArray(res.concerns)).toBe(true);
      expect(Array.isArray(res.recommendations)).toBe(true);
    });

    it("inclus les insights si absenceRate > 10", async () => {
      const input = makeStudentInput({ absenceRatePct: 20 });
      const res = await provider.generateSummary({ kind: "student", data: input });
      assertStudentSummary(res);
      expect(res.concerns.some((i) => i.includes("absence"))).toBe(true);
    });

    it("déterministe : même input = même output", async () => {
      const input = makeStudentInput({ absenceRatePct: 15, currentAvg: 10 });
      const r1 = await provider.generateSummary({ kind: "student", data: input });
      const r2 = await provider.generateSummary({ kind: "student", data: input });
      assertStudentSummary(r1);
      assertStudentSummary(r2);
      expect(r1).toEqual(r2);
    });
  });

  describe("generateSummary (class)", () => {
    it("retourne ClassSummary valide", async () => {
      const input = makeClassInput({ attendanceRatePct: 88, average: 11 });
      const res = await provider.generateSummary({ kind: "class", data: input });
      assertClassSummary(res);
      expect(res.className).toBe(input.className);
      expect(typeof res.attendanceRatePct).toBe("number");
      expect(typeof res.average).toBe("number");
      expect(Array.isArray(res.positives)).toBe(true);
      expect(Array.isArray(res.concerns)).toBe(true);
      expect(Array.isArray(res.recommendations)).toBe(true);
    });

    it("déterministe", async () => {
      const input = makeClassInput({ attendanceRatePct: 85 });
      const r1 = await provider.generateSummary({ kind: "class", data: input });
      const r2 = await provider.generateSummary({ kind: "class", data: input });
      assertClassSummary(r1);
      assertClassSummary(r2);
      expect(r1).toEqual(r2);
    });
  });

  describe("generateText", () => {
    it("retourne du texte sans erreur", async () => {
      const text = await provider.generateText({ prompt: "Test", temperature: 0.2 });
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe("generateStructured", () => {
    it("retourne le fallback sans erreur", async () => {
      const schema = z.object({ ok: z.boolean() });
      const fallback = { ok: true };
      const res = await provider.generateStructured({ prompt: "test", schema }, fallback);
      expect(res).toEqual(fallback);
    });
  });
});

describe("lib/ai/providers/mock.ts", () => {
  const provider = new MockProvider();

  it("nom = mock", () => {
    expect(provider.name).toBe("mock");
  });

  it("generateText retourne préfixe [mock]", async () => {
    const text = await provider.generateText({ prompt: "Hello world" });
    expect(text).toContain("[mock]");
  });

  it("generateStructured retourne fallback", async () => {
    const fallback = { test: "value" };
    const schema = z.object({ test: z.string() });
    const res = await provider.generateStructured({ prompt: "test", schema }, fallback);
    expect(res).toEqual(fallback);
  });

  it("generateSummary délègue au statistical", async () => {
    const input = makeStudentInput();
    const res = await provider.generateSummary({ kind: "student", data: input });
    assertStudentSummary(res);
    expect(typeof res.overview).toBe("string");
    expect(Array.isArray(res.strengths)).toBe(true);
    expect(Array.isArray(res.concerns)).toBe(true);
  });
});