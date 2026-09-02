import { describe, expect, it } from "vitest";
import { summarize } from "@/lib/db/attendance-history";
import type { AttendanceStatus } from "@/types/enums";

function row(status: AttendanceStatus) {
  return { status };
}

describe("summarize", () => {
  it("returns zeros with null rate for no rows", () => {
    expect(summarize([])).toEqual({
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      rate: null,
    });
  });

  it("counts each status correctly", () => {
    const rows = [
      row("present"),
      row("present"),
      row("absent"),
      row("late"),
      row("excused"),
    ];
    const s = summarize(rows);
    expect(s.total).toBe(5);
    expect(s.present).toBe(2);
    expect(s.absent).toBe(1);
    expect(s.late).toBe(1);
    expect(s.excused).toBe(1);
  });

  it("computes the presence rate as present+excused over total", () => {
    // 3 present, 1 excused, 1 absent, 1 late => 4/6 marked, ~67%
    const s = summarize([
      row("present"),
      row("present"),
      row("present"),
      row("excused"),
      row("absent"),
      row("late"),
    ]);
    expect(s.rate).toBe(Math.round((4 / 6) * 100));
  });

  it("never counts absent/late in the rate", () => {
    const s = summarize([row("absent"), row("absent"), row("late")]);
    expect(s.rate).toBe(0);
  });
});