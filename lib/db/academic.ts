import { createClient } from "@/lib/supabase/server";

// ── Helpers ────────────────────────────────────────────────────

export async function getTeacherId(
  userId: string,
  schoolId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Types ──────────────────────────────────────────────────────

export type AcademicPeriod = {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export type Assessment = {
  id: string;
  school_id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  academic_period_id: string;
  period_name: string;
  title: string;
  description: string | null;
  max_score: number;
  coefficient: number;
  assessment_date: string;
  published: boolean;
  created_at: string;
};

export type AssessmentSummary = {
  id: string;
  title: string;
  max_score: number;
  coefficient: number;
  assessment_date: string;
  published: boolean;
  subject_name: string;
  class_name: string;
  score_count: number;
};

export type GradeRow = {
  id: string;
  student_id: string;
  assessment_id: string | null;
  subject_id: string;
  title: string;
  score: number;
  max_score: number;
  coefficient: number;
  grade_date: string;
  comment: string | null;
  published_at: string | null;
  subject_name: string;
  student_first_name: string;
  student_last_name: string;
};

export type StudentGradeDetail = {
  assessment_id: string;
  title: string;
  description: string | null;
  max_score: number;
  coefficient: number;
  assessment_date: string;
  published_at: string | null;
  subject_name: string;
  score: number | null;
  comment: string | null;
};

export type SubjectAverage = {
  subject_id: string;
  subject_name: string;
  average: number | null;
  eval_count: number;
};

export type StudentAverages = {
  student_id: string;
  student_name: string;
  overall_average: number | null;
  total_evals: number;
  subjects: SubjectAverage[];
  latest_grade: { subject_name: string; score: number; max_score: number; grade_date: string } | null;
};

export type Announcement = {
  id: string;
  school_id: string;
  author_id: string | null;
  author_name: string | null;
  audience: string;
  classroom_id: string | null;
  classroom_name: string | null;
  title: string;
  body: string;
  important: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
};

// ── Periods ────────────────────────────────────────────────────

export async function getAcademicPeriods(schoolId: string): Promise<AcademicPeriod[]> {  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_periods")
    .select("id, school_id, academic_year_id, name, type, start_date, end_date, is_current")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false });

  if (error || !data) return [];
  return data;
}

export async function getCurrentPeriod(schoolId: string): Promise<AcademicPeriod | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_periods")
    .select("id, school_id, academic_year_id, name, type, start_date, end_date, is_current")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ── Assessments (teacher view) ─────────────────────────────────

/**
 * Returns assessments for a given class+subject (teacher's view, all periods).
 */
export async function getAssessmentsForClassSubject(
  classId: string,
  subjectId: string,
): Promise<AssessmentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id, title, max_score, coefficient, assessment_date, published, subject_id, subject:subjects(name), class_id, classes(name)")
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .order("assessment_date", { ascending: false });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    max_score: a.max_score,
    coefficient: a.coefficient,
    assessment_date: a.assessment_date,
    published: a.published,
    subject_name: a.subject?.[0]?.name ?? "—",
    class_name: a.classes?.[0]?.name ?? "—",
    score_count: 0,
  }));
}

/**
 * Returns all assessments for a given teacher across all their classes/subjects.
 */
export async function getTeacherAssessments(
  userId: string,
  periodId?: string,
): Promise<AssessmentSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("assessments")
    .select(`
      id, title, max_score, coefficient, assessment_date, published,
      subject_id, subject:subjects!inner(name),
      class_id, classes!inner(name),
      teacher_id, teachers!inner(user_id),
      academic_period_id
    `)
    .eq("teachers.user_id", userId)
    .order("assessment_date", { ascending: false });

  if (periodId) {
    query = query.eq("academic_period_id", periodId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    max_score: a.max_score,
    coefficient: a.coefficient,
    assessment_date: a.assessment_date,
    published: a.published,
    subject_name: a.subject?.[0]?.name ?? "—",
    class_name: a.classes?.[0]?.name ?? "—",
    score_count: 0,
  }));
}

// ── Grades (teacher editing view) ─────────────────────────────

/**
 * Returns all students + existing grades for a given assessment.
 * Used by the teacher grade-entry grid.
 */
export async function getGradesForAssessment(
  assessmentId: string,
): Promise<{
  students: { id: string; first_name: string; last_name: string }[];
  grades: {
    student_id: string;
    score: number | null;
    comment: string | null;
  }[];
  assessment: {
    id: string;
    title: string;
    max_score: number;
    coefficient: number;
    class_id: string;
    subject_id: string;
  };
}> {
  const supabase = await createClient();

  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .select("id, title, max_score, coefficient, class_id, subject_id")
    .eq("id", assessmentId)
    .single();

  if (aErr || !assessment) {
    return { students: [], grades: [], assessment: { id: assessmentId, title: "", max_score: 20, coefficient: 1, class_id: "", subject_id: "" } };
  }

  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("classroom_id", assessment.class_id)
    .order("last_name", { ascending: true });

  if (sErr || !students) return { students: [], grades: [], assessment };

  const { data: grades } = await supabase
    .from("grades")
    .select("student_id, score, comment")
    .eq("assessment_id", assessmentId);

  return {
    students: students as { id: string; first_name: string; last_name: string }[],
    grades: (grades ?? []) as { student_id: string; score: number | null; comment: string | null }[],
    assessment,
  };
}

/**
 * Returns published grades for a student (parent view).
 */
export async function getStudentGradesPublished(
  studentId: string,
): Promise<GradeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select(`
      id, student_id, assessment_id, subject_id, title, score, max_score, coefficient,
      grade_date, comment, published_at,
      subject:subjects!inner(name)
    `)
    .eq("student_id", studentId)
    .not("published_at", "is", null)
    .order("grade_date", { ascending: false });

  if (error || !data) return [];

  return data.map((g) => ({
    id: g.id,
    student_id: g.student_id,
    assessment_id: g.assessment_id,
    subject_id: g.subject_id,
    title: g.title,
    score: g.score,
    max_score: g.max_score,
    coefficient: g.coefficient,
    grade_date: g.grade_date,
    comment: g.comment,
    published_at: g.published_at,
    subject_name: g.subject?.[0]?.name ?? "—",
    student_first_name: "",
    student_last_name: "",
  }));
}

// ── Averages ───────────────────────────────────────────────────

/**
 * Compute subject averages for a student from published grades.
 * Returns null average when insufficient data.
 */
export type GradeInput = {
  score: number;
  max_score: number;
  coefficient: number;
  subject_id: string;
  subject_name?: string;
};

export type ComputedAverage = {
  overall_average: number | null;
  total_evals: number;
  subjects: SubjectAverage[];
};

// Pure average computation. Rounds to 2 decimals. Unpublished entries are
// excluded by the caller (only published rows are passed in).
export function computeAverages(grades: GradeInput[]): ComputedAverage {
  const subjectMap = new Map<
    string,
    { name: string; weightedSum: number; coeffSum: number; count: number }
  >();
  let totalWeightedSum = 0;
  let totalCoeffSum = 0;
  let totalCount = 0;

  for (const g of grades) {
    if (g.max_score <= 0) continue;
    const normalizedScore = (g.score / g.max_score) * 20;
    const weighted = normalizedScore * g.coefficient;

    totalWeightedSum += weighted;
    totalCoeffSum += g.coefficient;
    totalCount++;

    let s = subjectMap.get(g.subject_id);
    if (!s) {
      s = {
        name: g.subject_name ?? "",
        weightedSum: 0,
        coeffSum: 0,
        count: 0,
      };
      subjectMap.set(g.subject_id, s);
    }
    s.weightedSum += weighted;
    s.coeffSum += g.coefficient;
    s.count++;
  }

  const subjects: SubjectAverage[] = Array.from(subjectMap.entries()).map(
    ([subject_id, s]) => ({
      subject_id,
      subject_name: s.name,
      average:
        s.count > 0 ? Math.round((s.weightedSum / s.coeffSum) * 100) / 100 : null,
      eval_count: s.count,
    })
  );

  return {
    overall_average:
      totalCoeffSum > 0
        ? Math.round((totalWeightedSum / totalCoeffSum) * 100) / 100
        : null,
    total_evals: totalCount,
    subjects,
  };
}

export async function getStudentAverages(
  studentId: string,
): Promise<StudentAverages> {
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();

  const name = student
    ? `${student.first_name} ${student.last_name}`
    : "";

  const { data: grades, error } = await supabase
    .from("grades")
    .select(`
      score, max_score, coefficient, published_at,
      subject_id, subject:subjects!inner(name)
    `)
    .eq("student_id", studentId)
    .not("published_at", "is", null);

  if (error || !grades || grades.length === 0) {
    return { student_id: studentId, student_name: name, overall_average: null, total_evals: 0, subjects: [], latest_grade: null };
  }

  type GRow = {
    score: number;
    max_score: number;
    coefficient: number;
    subject_id: string;
    subject: { name: string } | null;
    published_at: string | null;
  };

  const typedGrades = grades as unknown as GRow[];
  const inputs: GradeInput[] = typedGrades
    .filter((g) => g.subject)
    .map((g) => ({
      score: g.score,
      max_score: g.max_score,
      coefficient: g.coefficient,
      subject_id: g.subject_id,
      subject_name: g.subject?.name,
    }));

  const { overall_average, total_evals, subjects } = computeAverages(inputs);

  // Latest grade
  const latest = typedGrades[0];
  const latestGrade = latest?.subject
    ? {
        subject_name: latest.subject.name,
        score: latest.score,
        max_score: latest.max_score,
        grade_date: "",
      }
    : null;

  return {
    student_id: studentId,
    student_name: name,
    overall_average,
    total_evals,
    subjects,
    latest_grade: latestGrade,
  };
}

// ── Admin school averages ──────────────────────────────────────

export type SchoolClassAverage = {
  class_id: string;
  class_name: string;
  average: number | null;
  eval_count: number;
};

// Pure aggregation of raw grade rows grouped by classroom. Rows already assume
// they are published (caller filters). `total_evals` here counts weighted rows.
export function computeClassAverages(
  rows: { score: number; max_score: number; coefficient: number; classroom_id: string | null }[]
): {
  overall_average: number | null;
  total_evals: number;
  byClass: Map<string, { wSum: number; cSum: number; count: number }>;
} {
  let totalW = 0;
  let totalC = 0;
  let totalEvals = 0;
  const classMap = new Map<string, { wSum: number; cSum: number; count: number }>();

  for (const g of rows) {
    if (g.max_score <= 0) continue;
    const ns = (g.score / g.max_score) * 20;
    totalW += ns * g.coefficient;
    totalC += g.coefficient;
    totalEvals++;
    if (g.classroom_id) {
      let c = classMap.get(g.classroom_id);
      if (!c) { c = { wSum: 0, cSum: 0, count: 0 }; classMap.set(g.classroom_id, c); }
      c.wSum += ns * g.coefficient;
      c.cSum += g.coefficient;
      c.count++;
    }
  }

  return {
    overall_average: totalC > 0 ? Math.round((totalW / totalC) * 100) / 100 : null,
    total_evals: totalEvals,
    byClass: classMap,
  };
}

export async function getSchoolAverages(schoolId: string): Promise<{
  overall_average: number | null;
  total_evals: number;
  total_subjects: number;
  by_class: SchoolClassAverage[];
}> {
  const supabase = await createClient();

  const { data: grades, error } = await supabase
    .from("grades")
    .select("score, max_score, coefficient, classroom_id, subject_id")
    .eq("school_id", schoolId)
    .not("published_at", "is", null);

  if (error || !grades || grades.length === 0) {
    return { overall_average: null, total_evals: 0, total_subjects: 0, by_class: [] };
  }

  type GRow = { score: number; max_score: number; coefficient: number; classroom_id: string | null; subject_id: string };

  const typed = grades as unknown as GRow[];

  const subjects = new Set<string>();
  for (const g of typed) subjects.add(g.subject_id);

  const { overall_average, total_evals, byClass } = computeClassAverages(typed);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId);

  const classNames = new Map<string, string>();
  if (classes) for (const c of classes as { id: string; name: string }[]) classNames.set(c.id, c.name);

  const by_class: SchoolClassAverage[] = Array.from(byClass.entries()).map(([id, c]) => ({
    class_id: id,
    class_name: classNames.get(id) ?? "—",
    average: c.cSum > 0 ? Math.round((c.wSum / c.cSum) * 100) / 100 : null,
    eval_count: c.count,
  }));

  return {
    overall_average,
    total_evals,
    total_subjects: subjects.size,
    by_class,
  };
}

// ── Announcements (parent view) ────────────────────────────────

/**
 * Returns published, non-archived announcements visible to a parent:
 * - school-wide (audience=all), OR
 * - class-specific (audience=class) for any of the parent's children's classes.
 */
export async function getParentAnnouncements(
  userId: string,
  schoolId: string,
): Promise<Announcement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(`
      id, school_id, author_id, audience, classroom_id, title, body, important,
      published_at, archived_at, created_at,
      profiles:author_id(full_name),
      classes:classroom_id(name)
    `)
    .eq("school_id", schoolId)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Filter to those relevant to this parent's children's classes
  const { data: childClasses } = await supabase
    .from("student_parents")
    .select("students!inner(classroom_id, school_id)")
    .eq("parents.user_id", userId);

  const parentClassIds = new Set<string>();
  if (childClasses) {
    for (const row of childClasses as {
      students: { classroom_id: string; school_id: string }[];
    }[]) {
      for (const st of row.students) {
        if (st.school_id === schoolId && st.classroom_id) {
          parentClassIds.add(st.classroom_id);
        }
      }
    }
  }

  return data
    .filter((a) => {
      if (a.audience === "all") return true;
      if (a.audience === "class" && a.classroom_id) return parentClassIds.has(a.classroom_id);
      return false;
    })
    .map((a) => ({
      id: a.id,
      school_id: a.school_id,
      author_id: a.author_id,
      author_name: a.profiles?.[0]?.full_name ?? null,
      audience: a.audience,
      classroom_id: a.classroom_id,
      classroom_name: a.classes?.[0]?.name ?? null,
      title: a.title,
      body: a.body,
      important: a.important,
      published_at: a.published_at,
      archived_at: a.archived_at,
      created_at: a.created_at,
    }));
}

/**
 * Returns all announcements for an admin (school, published + unpublished + archived).
 */
export async function getAdminAnnouncements(schoolId: string): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      id, school_id, author_id, audience, classroom_id, title, body, important,
      published_at, archived_at, created_at,
      profiles:author_id(full_name),
      classes:classroom_id(name)
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    school_id: a.school_id,
    author_id: a.author_id,
    author_name: a.profiles?.[0]?.full_name ?? null,
    audience: a.audience,
    classroom_id: a.classroom_id,
    classroom_name: a.classes?.[0]?.name ?? null,
    title: a.title,
    body: a.body,
    important: a.important,
    published_at: a.published_at,
    archived_at: a.archived_at,
    created_at: a.created_at,
  }));
}
