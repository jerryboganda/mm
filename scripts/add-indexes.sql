-- ═══════════════════════════════════════════════════════════════
-- Maternal Mind — Database Indexes Migration (P1 DATA-004)
-- Run against your PostgreSQL database to add performance indexes
-- ═══════════════════════════════════════════════════════════════

-- User-scoped queries: progress, bookmarks, attempts, activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_progress_user_id
  ON user_progress (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_progress_user_topic
  ON user_progress (user_id, topic_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user_id
  ON bookmarks (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user_topic
  ON bookmarks (user_id, topic_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_attempts_user_id
  ON quiz_attempts (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_attempts_user_created
  ON quiz_attempts (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_activity_user_id
  ON recent_activity (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_activity_user_topic
  ON recent_activity (user_id, topic_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_activity_user_viewed
  ON recent_activity (user_id, viewed_at DESC);

-- Content hierarchy lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_book_id
  ON chapters (book_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_chapter_id
  ON topics (chapter_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_blocks_topic_id
  ON content_blocks (topic_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcqs_topic_id
  ON mcqs (topic_id);

-- Search optimization: trigram indexes for ILIKE queries
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_title_trgm
  ON books USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_title_trgm
  ON chapters USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_title_trgm
  ON topics USING gin (title gin_trgm_ops);

-- Password reset token lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens (token) WHERE used = false;

-- Published content filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_books_published
  ON books (is_published) WHERE is_published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_published_book
  ON chapters (book_id, "order") WHERE is_published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_published_chapter
  ON topics (chapter_id, "order") WHERE is_published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcqs_published_topic
  ON mcqs (topic_id) WHERE is_published = true;

-- ═══════════════════════════════════════════════════════════════
-- P3: Spaced Repetition (review_schedule) indexes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_schedule_user_id
  ON review_schedule (user_id);

-- Due reviews: user + next_review_at for efficient due-card queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_schedule_user_due
  ON review_schedule (user_id, next_review_at ASC);

-- Prevent duplicate user+mcq entries (functional unique)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_review_schedule_user_mcq
  ON review_schedule (user_id, mcq_id);

-- ═══════════════════════════════════════════════════════════════
-- P3: Content Reports (content_reports) indexes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_reports_user_id
  ON content_reports (user_id);

-- Admin filtering by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_reports_status
  ON content_reports (status);

-- Pending reports for admin dashboard badge
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_reports_pending
  ON content_reports (created_at DESC) WHERE status = 'pending';
