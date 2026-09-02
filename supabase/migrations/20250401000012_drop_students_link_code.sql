-- ============================================================
-- EduTrack :: 0012_drop_students_link_code.sql
-- Suppression de la colonne `students.link_code` (stockée en
-- clair). L'architecture de liaison passe désormais
-- exclusivement par `student_link_codes` (code haché).
-- La suppression retire également la contrainte
-- `unique (school_id, link_code)` et l'index
-- `idx_students_link_code` qui en dépendent.
-- ============================================================

alter table public.students drop column if exists link_code;