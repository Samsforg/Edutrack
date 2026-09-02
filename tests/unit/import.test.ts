import { describe, it, expect } from "vitest";
import {
  parseCsv,
  buildPreview,
  csvTemplate,
  _normKey,
} from "@/lib/import/parse";
import {
  sanitizeCsvCell,
  csvRow,
} from "@/lib/csv";

const studentsHeader =
  "matricule,first_name,last_name,date_of_birth,gender,class_name";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    const out = parseCsv("a,b\nc,d");
    expect(out).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    const out = parseCsv('a,"b, c",d');
    expect(out).toEqual([["a", "b, c", "d"]]);
  });

  it("handles escaped double quotes", () => {
    const out = parseCsv('"say ""hi""",x');
    expect(out).toEqual([['say "hi"', "x"]]);
  });

  it("normalizes CRLF and skips blank lines", () => {
    const out = parseCsv("a\r\n\r\nb\nc");
    expect(out).toEqual([["a"], ["b"], ["c"]]);
  });
});

describe("buildPreview (students)", () => {
  it("counts valid rows", () => {
    const csv = `${studentsHeader}\nEDU1,Jean,Kouassi,2012-05-10,M,3e A\nEDU2,Marie,Yao,2012-08-22,F,3e A`;
    const prev = buildPreview("students", csv, {
      identity: (r) => `${r.matricule}`,
    });
    expect(prev.total).toBe(2);
    expect(prev.valid).toBe(2);
    expect(prev.invalid).toBe(0);
  });

  it("flags missing required field", () => {
    const csv = `${studentsHeader}\nEDU1,Jean,,2012-05-10,M,3e A`;
    const prev = buildPreview("students", csv);
    expect(prev.invalid).toBe(1);
    expect(prev.rows[0].error?.field).toBe("last_name");
  });

  it("flags invalid email for parents", () => {
    const csv = `first_name,last_name,email,phone\nAwa,Koné,not-an-email,0700000001`;
    const prev = buildPreview("parents", csv);
    expect(prev.invalid).toBe(1);
    expect(prev.rows[0].error?.field).toBe("email");
  });

  it("detects duplicates within the file", () => {
    const csv = `${studentsHeader}\nEDU1,Jean,Kouassi,2012-05-10,M,3e A\nEDU1,Jean,Kouassi,2012-05-10,M,3e A`;
    const prev = buildPreview("students", csv, {
      identity: (r) => `${r.matricule}`,
    });
    expect(prev.duplicates).toBe(1);
    expect(prev.rows[1].duplicate).toBe(true);
  });

  it("detects duplicates against existing keys", () => {
    const csv = `${studentsHeader}\nEDU1,Jean,Kouassi,2012-05-10,M,3e A`;
    const prev = buildPreview("students", csv, {
      duplicateKeys: new Set(["EDU1"]),
      identity: (r) => `${r.matricule}`,
    });
    expect(prev.valid).toBe(0);
    expect(prev.duplicates).toBe(1);
  });
});

describe("normKey", () => {
  it("normalizes accents and whitespace", () => {
    expect(_normKey("Prénom Élève")).toBe("prenomeleve");
    expect(_normKey("first_name")).toBe("firstname");
  });
});

describe("csvTemplate", () => {
  it("produces a header + sample row", () => {
    const t = csvTemplate("subjects");
    expect(t.split("\n")).toEqual(["code,name", "MATH,Mathématiques"]);
  });
});

describe("CSV formula injection protection", () => {
  it("neutralizes cells starting with = + - @", () => {
    expect(sanitizeCsvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(sanitizeCsvCell("+123")).toBe('"\'+123"');
    expect(sanitizeCsvCell("-cmd")).toBe("\"'-cmd\"");
    expect(sanitizeCsvCell("@import")).toBe('"\'@import"');
  });

  it("leaves normal cells unchanged and escapes quotes", () => {
    expect(sanitizeCsvCell("Jean")).toBe('"Jean"');
    expect(sanitizeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("joins rows with csvRow and protects all cells", () => {
    const line = csvRow(["=1+1", "Jean", ""]);
    expect(line).toBe('"\'=1+1","Jean",""');
  });
});
