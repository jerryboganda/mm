-- WIPE ALL STUDY MATERIALS & STUDENT PROGRESS DATA
-- Preserves: users, user_sessions, subscriptions, package tables, app_settings, announcements, audit_logs

TRUNCATE TABLE 
  quiz_attempts, 
  user_progress, 
  bookmarks, 
  review_schedule, 
  recent_activity, 
  content_reports, 
  mcqs, 
  content_blocks, 
  topics, 
  chapters, 
  books 
RESTART IDENTITY CASCADE;
