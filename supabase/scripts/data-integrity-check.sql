-- ============================================================
-- EduTrack :: Data Integrity Checks
-- Exécuter périodiquement (cron hebdo) ou avant migration majeure
-- ============================================================

-- 1. Orphelins : élèves sans école
SELECT 'students_without_school' AS check_name, count(*) AS count
FROM public.students s
LEFT JOIN public.schools sc ON sc.id = s.school_id
WHERE sc.id IS NULL;

-- 2. Orphelins : classes sans école
SELECT 'classes_without_school' AS check_name, count(*) AS count
FROM public.classes c
LEFT JOIN public.schools sc ON sc.id = c.school_id
WHERE sc.id IS NULL;

-- 3. Orphelins : enseignants sans école
SELECT 'teachers_without_school' AS check_name, count(*) AS count
FROM public.teachers t
LEFT JOIN public.schools sc ON sc.id = t.school_id
WHERE sc.id IS NULL;

-- 4. Orphelins : parents sans école
SELECT 'parents_without_school' AS check_name, count(*) AS count
FROM public.parents p
LEFT JOIN public.schools sc ON sc.id = p.school_id
WHERE sc.id IS NULL;

-- 5. Orphelins : présences sans élève
SELECT 'attendance_without_student' AS check_name, count(*) AS count
FROM public.attendance a
LEFT JOIN public.students s ON s.id = a.student_id
WHERE s.id IS NULL;

-- 6. Orphelins : notes sans élève
SELECT 'grades_without_student' AS check_name, count(*) AS count
FROM public.grades g
LEFT JOIN public.students s ON s.id = g.student_id
WHERE s.id IS NULL;

-- 7. Orphelins : notes sans évaluation
SELECT 'grades_without_assessment' AS check_name, count(*) AS count
FROM public.grades g
LEFT JOIN public.assessments a ON a.id = g.assessment_id
WHERE g.assessment_id IS NOT NULL AND a.id IS NULL;

-- 8. Orphelins : évaluations sans classe
SELECT 'assessments_without_class' AS check_name, count(*) AS count
FROM public.assessments a
LEFT JOIN public.classes c ON c.id = a.class_id
WHERE c.id IS NULL;

-- 9. Orphelins : évaluations sans matière
SELECT 'assessments_without_subject' AS check_name, count(*) AS count
FROM public.assessments a
LEFT JOIN public.subjects s ON s.id = a.subject_id
WHERE s.id IS NULL;

-- 10. Orphelins : class_subjects sans classe
SELECT 'class_subjects_without_class' AS check_name, count(*) AS count
FROM public.class_subjects cs
LEFT JOIN public.classes c ON c.id = cs.class_id
WHERE c.id IS NULL;

-- 11. Orphelins : class_subjects sans matière
SELECT 'class_subjects_without_subject' AS check_name, count(*) AS count
FROM public.class_subjects cs
LEFT JOIN public.subjects s ON s.id = cs.subject_id
WHERE s.id IS NULL;

-- 12. Orphelins : class_subjects sans enseignant
SELECT 'class_subjects_without_teacher' AS check_name, count(*) AS count
FROM public.class_subjects cs
LEFT JOIN public.teachers t ON t.id = cs.teacher_id
WHERE t.id IS NULL;

-- 13. Orphelins : student_parents sans élève
SELECT 'student_parents_without_student' AS check_name, count(*) AS count
FROM public.student_parents sp
LEFT JOIN public.students s ON s.id = sp.student_id
WHERE s.id IS NULL;

-- 14. Orphelins : student_parents sans parent
SELECT 'student_parents_without_parent' AS check_name, count(*) AS count
FROM public.student_parents sp
LEFT JOIN public.parents p ON p.id = sp.parent_id
WHERE p.id IS NULL;

-- 15. Orphelins : annonces sans école
SELECT 'announcements_without_school' AS check_name, count(*) AS count
FROM public.announcements a
LEFT JOIN public.schools sc ON sc.id = a.school_id
WHERE sc.id IS NULL;

-- 16. Orphelins : notifications sans utilisateur
SELECT 'notifications_without_user' AS check_name, count(*) AS count
FROM public.notifications n
LEFT JOIN public.profiles p ON p.id = n.user_id
WHERE p.id IS NULL;

-- 17. Incohérences : note > max_score
SELECT 'grades_score_exceeds_max' AS check_name, count(*) AS count
FROM public.grades
WHERE score > max_score;

-- 18. Incohérences : coefficient <= 0
SELECT 'grades_invalid_coefficient' AS check_name, count(*) AS count
FROM public.grades
WHERE coefficient <= 0;

-- 19. Incohérences : max_score <= 0
SELECT 'grades_invalid_max_score' AS check_name, count(*) AS count
FROM public.grades
WHERE max_score <= 0;

-- 20. Incohérences : présence future
SELECT 'attendance_future_date' AS check_name, count(*) AS count
FROM public.attendance
WHERE attendance_date > CURRENT_DATE;

-- 21. Incohérences : élève dans classe d'une autre école
SELECT 'student_wrong_school_class' AS check_name, count(*) AS count
FROM public.students s
JOIN public.classes c ON c.id = s.classroom_id
WHERE s.school_id != c.school_id;

-- 22. Incohérences : enseignant dans classe d'une autre école
SELECT 'teacher_wrong_school_class' AS check_name, count(*) AS count
FROM public.class_subjects cs
JOIN public.teachers t ON t.id = cs.teacher_id
JOIN public.classes c ON c.id = cs.class_id
WHERE t.school_id != c.school_id;

-- 23. Incohérences : matière d'une autre école
SELECT 'subject_wrong_school_class' AS check_name, count(*) AS count
FROM public.class_subjects cs
JOIN public.subjects s ON s.id = cs.subject_id
JOIN public.classes c ON c.id = cs.class_id
WHERE s.school_id != c.school_id;

-- 24. Incohérences : abonnement sans école
SELECT 'subscription_without_school' AS check_name, count(*) AS count
FROM public.school_subscriptions ss
LEFT JOIN public.schools sc ON sc.id = ss.school_id
WHERE sc.id IS NULL;

-- 25. Incohérences : plan d'abonnement manquant
SELECT 'subscription_without_plan' AS check_name, count(*) AS count
FROM public.school_subscriptions ss
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id
WHERE sp.id IS NULL;

-- 26. Doublons : matricule élève dupliqué dans même école
SELECT 'duplicate_student_matricule' AS check_name, count(*) AS count
FROM (
  SELECT school_id, matricule, count(*) AS cnt
  FROM public.students
  GROUP BY school_id, matricule
  HAVING count(*) > 1
) d;

-- 27. Doublons : code employé enseignant dupliqué
SELECT 'duplicate_teacher_employee_number' AS check_name, count(*) AS count
FROM (
  SELECT school_id, employee_number, count(*) AS cnt
  FROM public.teachers
  GROUP BY school_id, employee_number
  HAVING count(*) > 1
) d;

-- 28. Doublons : liaison parent-élève dupliquée
SELECT 'duplicate_student_parent' AS check_name, count(*) AS count
FROM (
  SELECT student_id, parent_id, count(*) AS cnt
  FROM public.student_parents
  GROUP BY student_id, parent_id
  HAVING count(*) > 1
) d;

-- 29. Doublons : class_subjects dupliqué (classe + matière)
SELECT 'duplicate_class_subject' AS check_name, count(*) AS count
FROM (
  SELECT class_id, subject_id, count(*) AS cnt
  FROM public.class_subjects
  GROUP BY class_id, subject_id
  HAVING count(*) > 1
) d;

-- 30. Incohérences : période académique sans année
SELECT 'period_without_year' AS check_name, count(*) AS count
FROM public.academic_periods ap
LEFT JOIN public.academic_years ay ON ay.id = ap.academic_year_id
WHERE ay.id IS NULL;

-- 31. Incohérences : année scolaire sans école
SELECT 'year_without_school' AS check_name, count(*) AS count
FROM public.academic_years ay
LEFT JOIN public.schools sc ON sc.id = ay.school_id
WHERE sc.id IS NULL;

-- 32. Incohérences : école sans admin
SELECT 'school_without_admin' AS check_name, count(*) AS count
FROM public.schools s
LEFT JOIN public.school_members sm ON sm.school_id = s.id AND sm.role = 'SCHOOL_ADMIN'
WHERE sm.id IS NULL;

-- 33. AI : insights sans école
SELECT 'ai_insights_without_school' AS check_name, count(*) AS count
FROM public.ai_insights ai
LEFT JOIN public.schools s ON s.id = ai.school_id
WHERE s.id IS NULL;

-- 34. AI : insights orphelins (élève supprimé mais insight reste)
SELECT 'ai_insights_orphan_student' AS check_name, count(*) AS count
FROM public.ai_insights ai
LEFT JOIN public.students s ON s.id = ai.student_id
WHERE ai.student_id IS NOT NULL AND s.id IS NULL;

-- 35. AI : usage sans école
SELECT 'ai_usage_without_school' AS check_name, count(*) AS count
FROM public.ai_usage au
LEFT JOIN public.schools s ON s.id = au.school_id
WHERE s.id IS NULL;

-- 36. Feature flags : clé dupliquée (global + école)
SELECT 'feature_flags_duplicate_key' AS check_name, count(*) AS count
FROM (
  SELECT key, school_id, count(*) AS cnt
  FROM public.feature_flags
  GROUP BY key, school_id
  HAVING count(*) > 1
) d;

-- 37. Communications prefs : user_id dupliqué pour même école
SELECT 'comm_prefs_duplicate' AS check_name, count(*) AS count
FROM (
  SELECT user_id, school_id, count(*) AS cnt
  FROM public.communication_preferences
  GROUP BY user_id, school_id
  HAVING count(*) > 1
) d;

-- 38. Résumé global
SELECT 'SUMMARY' AS check_name,
  (SELECT count(*) FROM public.schools) AS schools,
  (SELECT count(*) FROM public.students) AS students,
  (SELECT count(*) FROM public.teachers) AS teachers,
  (SELECT count(*) FROM public.parents) AS parents,
  (SELECT count(*) FROM public.classes) AS classes,
  (SELECT count(*) FROM public.attendance) AS attendance_records,
  (SELECT count(*) FROM public.grades) AS grade_records,
  (SELECT count(*) FROM public.ai_insights) AS ai_insights,
  (SELECT count(*) FROM public.ai_audit_logs) AS ai_audit_logs;