export type ImportEntityType =
  | "students"
  | "parents"
  | "teachers"
  | "classes"
  | "subjects";

export type ImportRowError = {
  row: number; // 1-based, header excluded
  field?: string;
  value?: string;
  error: string;
  solution?: string;
};

export type ImportRow<T = Record<string, string>> = {
  row: number;
  data: T;
  valid: boolean;
  error?: ImportRowError;
  duplicate?: boolean;
};

export type ImportPreview<T = Record<string, string>> = {
  entity: ImportEntityType;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: ImportRow<T>[];
  header: string[];
};

/**
 * Parses CSV text into rows of string values, handling quoted fields,
 * embedded commas and double-quote escapes. Skips blank lines.
 */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    if (!(current.length === 1 && current[0] === "")) {
      rows.push(current);
    }
    current = [];
  };

  const src = raw.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else {
      field += ch;
    }
  }
  if (!(current.length === 0 && field === "")) {
    pushField();
    pushRow();
  }
  return rows;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-._]+/g, "")
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ûüù]/g, "u")
    .replace(/ç/g, "c");
}

export type ColumnSpec = {
  key: string;
  aliases?: string[];
  optional?: boolean;
  validate?: (value: string) => string | null;
  solution?: string;
};

/**
 * True when a (normalized) header name matches a column spec, either by exact
 * canonical key, normalized canonical key, or an alias (normalized).
 */
function specMatches(spec: ColumnSpec, normHeader: string): boolean {
  return (
    spec.key === normHeader ||
    normKey(spec.key) === normHeader ||
    !!spec.aliases?.some((a) => normKey(a) === normHeader)
  );
}

// ── Validators ──────────────────────────────────────────────
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const phoneRe = /^\+?[0-9 ()-]{6,20}$/;

function errIf(cond: boolean, msg: string): string | null {
  return cond ? msg : null;
}

// ── Entity schemas ──────────────────────────────────────────
export const IMPORT_SCHEMAS: Record<
  ImportEntityType,
  { label: string; specs: ColumnSpec[] }
> = {
  students: {
    label: "Élèves",
    specs: [
      { key: "matricule", solution: "Matricule unique par élève." },
      {
        key: "first_name",
        aliases: ["prénom", "prenom"],
        solution: "Prénom de l'élève.",
      },
      { key: "last_name", aliases: ["nom"], solution: "Nom de l'élève." },
      {
        key: "date_of_birth",
        aliases: ["datedenaissance", "date", "naissance", "datenais"],
        optional: true,
        validate: (v) =>
          errIf(!dateRe.test(v) || Number.isNaN(Date.parse(v)), "Date invalide (AAAA-MM-JJ)."),
      },
      {
        key: "gender",
        aliases: ["sexe"],
        optional: true,
        validate: (v) =>
          errIf(
            !["M", "F"].includes(v.toUpperCase()),
            "Genre invalide (M ou F)."
          ),
      },
      {
        key: "class_name",
        aliases: ["classe"],
        optional: true,
        solution: "La classe doit déjà exister dans l'établissement.",
      },
    ],
  },
  parents: {
    label: "Parents",
    specs: [
      { key: "first_name", aliases: ["prénom", "prenom"] },
      { key: "last_name", aliases: ["nom"] },
      {
        key: "email",
        optional: true,
        validate: (v) => errIf(!emailRe.test(v), "Email invalide."),
      },
      {
        key: "phone",
        optional: true,
        validate: (v) => errIf(!phoneRe.test(v), "Téléphone invalide."),
      },
    ],
  },
  teachers: {
    label: "Enseignants",
    specs: [
      {
        key: "employee_number",
        aliases: ["numeroemploye", "numeromple", "numemp"],
        solution: "N° employé unique.",
      },
      { key: "first_name", aliases: ["prénom", "prenom"] },
      { key: "last_name", aliases: ["nom"] },
      {
        key: "email",
        optional: true,
        validate: (v) => errIf(!emailRe.test(v), "Email invalide."),
      },
      {
        key: "phone",
        optional: true,
        validate: (v) => errIf(!phoneRe.test(v), "Téléphone invalide."),
      },
    ],
  },
  classes: {
    label: "Classes",
    specs: [
      { key: "name", aliases: ["nom"], solution: "Nom de la classe (ex. 6ème A)." },
      {
        key: "level",
        aliases: ["niveau"],
        optional: true,
        solution: "Niveau facultatif (ex. 6ème, 3ème).",
      },
      {
        key: "academic_year_name",
        aliases: ["anneesco", "annee", "year"],
        optional: true,
        solution: "Nom de l'année scolaire, sinon l'année courante.",
      },
    ],
  },
  subjects: {
    label: "Matières",
    specs: [
      { key: "code", solution: "Code unique (ex. MATH)." },
      { key: "name", aliases: ["nom"], solution: "Nom de la matière." },
    ],
  },
};

export const IMPORT_COLUMN_DEFS: Record<ImportEntityType, string[][]> = {
  students: [
    ["matricule", "first_name", "last_name", "date_of_birth", "gender", "class_name"],
    ["EDU001", "Jean", "Kouassi", "2012-05-10", "M", "3e A"],
    ["EDU002", "Marie", "Yao", "2012-08-22", "F", "3e A"],
  ],
  parents: [
    ["first_name", "last_name", "email", "phone"],
    ["Awa", "Koné", "awa@example.com", "0700000001"],
  ],
  teachers: [
    ["employee_number", "first_name", "last_name", "email", "phone"],
    ["ENS001", "Paul", "Koffi", "paul@example.com", "0700000000"],
  ],
  classes: [
    ["name", "level", "academic_year_name"],
    ["6ème A", "6ème", "2025-2026"],
  ],
  subjects: [
    ["code", "name"],
    ["MATH", "Mathématiques"],
  ],
};

export function csvTemplate(entity: ImportEntityType): string {
  return IMPORT_COLUMN_DEFS[entity]
    .map((r) => r.join(","))
    .join("\n");
}

/**
 * Produces a preview (validation + duplicate detection) for a CSV import.
 * `duplicateKeys` is the set of already-imported identity keys to mark rows
 * as duplicates (e.g. existing matricules / employee numbers).
 */
export function buildPreview<T = Record<string, string>>(
  entity: ImportEntityType,
  raw: string,
  options?: {
    duplicateKeys?: Set<string>;
    identity?: (record: { [k: string]: string }) => string;
  }
): ImportPreview<T> {
  const rows = parseCsv(raw);
  const dupKeys = options?.duplicateKeys ?? new Set<string>();
  const picked = new Set<string>();
  const specs = IMPORT_SCHEMAS[entity].specs;

  if (rows.length === 0) {
    return { entity, total: 0, valid: 0, invalid: 0, duplicates: 0, rows: [], header: [] };
  }

  // Skip header line if it contains a known column.
  const first = rows[0].map(normKey);
  const headerIdx = first.some((k) => specs.some((s) => specMatches(s, k)))
      ? 1
      : 0;

  const header = rows[headerIdx - 1] ?? [];
  const out: ImportRow<T>[] = [];
  let valid = 0;
  let invalid = 0;
  let duplicates = 0;

  for (let i = headerIdx; i < rows.length; i++) {
    const cells = rows[i];
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      const key = normKey(h);
      // map alias to canonical key
      const spec = specs.find((s) => specMatches(s, key));
      rec[spec?.key ?? key] = idx < cells.length ? cells[idx] : "";
    });

    // validation
    let err: ImportRowError | null = null;
    for (const spec of specs) {
      const value = rec[spec.key] ?? "";
      if (value === "" && !spec.optional) {
        err = {
          row: i,
          field: spec.key,
          value: "",
          error: `${spec.key} requis`,
          solution: spec.solution,
        };
        break;
      }
      if (value !== "" && spec.validate) {
        const vErr = spec.validate(value);
        if (vErr) {
          err = { row: i, field: spec.key, value, error: vErr, solution: spec.solution };
          break;
        }
      }
    }

    // duplicate detection
    let duplicate = false;
    if (!err && options?.identity) {
      const key = options.identity(rec);
      if (picked.has(key) || dupKeys.has(key)) {
        duplicate = true;
      } else {
        picked.add(key);
      }
    }

    if (err) invalid++;
    else if (duplicate) duplicates++;
    else valid++;

    out.push({ row: i + 1, data: rec as T, valid: !err && !duplicate, error: err ?? undefined, duplicate });
  }

  return {
    entity,
    total: out.length,
    valid,
    invalid,
    duplicates,
    rows: out,
    header,
  };
}

// exported for tests
export function _normKey(s: string) {
  return normKey(s);
}
