import dotenv from "dotenv";
import crypto from "crypto";
import { db, isMysql } from "../server/db";
import {
  books,
  chapters,
  topics,
  subtopics,
  contentBlocks,
  userProgress,
  bookmarks,
} from "../shared/schema";
import { eq, and, sql, asc, isNull } from "drizzle-orm";

dotenv.config();

/**
 * Strips HTML tags and extracts text content from a heading string
 */
function cleanHeadingTitle(raw: string): string {
  const stripped = raw.replace(/<[^>]+>/g, "").trim();
  const cleaned = stripped.replace(/^#+\s*/, "").trim();
  return cleaned.replace(/\s+/g, " ");
}

/**
 * Checks if a content block represents a heading or section start
 */
function extractHeading(block: { type: string; content: string }): string | null {
  if (!block?.content || typeof block.content !== "string") {
    return null;
  }

  if (block.type === "heading" && block.content.trim()) {
    return cleanHeadingTitle(block.content);
  }

  // Check for HTML headings
  const hMatch = block.content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  if (hMatch && hMatch[1].trim()) {
    const title = cleanHeadingTitle(hMatch[1]);
    if (title.length >= 2 && title.length <= 150) {
      return title;
    }
  }

  // Check markdown heading if type is text or markdown
  if (block.type === "text" || block.type === "markdown") {
    const mdMatch = block.content.match(/^(?:#{1,3})\s+(.+)$/m);
    if (mdMatch && mdMatch[1].trim()) {
      const title = cleanHeadingTitle(mdMatch[1]);
      if (title.length >= 2 && title.length <= 150) {
        return title;
      }
    }
  }

  return null;
}

export async function migrateToSubtopics(opts?: { dryRun?: boolean }) {
  const dryRun = opts?.dryRun ?? false;
  console.log(`[MIGRATION] Starting Book > Topic > Subtopics migration (dryRun: ${dryRun})`);

  // Step 1: Ensure schema columns/tables exist if executing against live DB
  if (!dryRun) {
    try {
      console.log("[MIGRATION] Step 1: Ensuring DDL tables and columns exist...");
      if (!isMysql) {
        await db.execute(sql`
          ALTER TABLE topics ADD COLUMN IF NOT EXISTS book_id varchar REFERENCES books(id) ON DELETE CASCADE;
          ALTER TABLE topics ALTER COLUMN chapter_id DROP NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_topics_book_published ON topics(book_id, is_published);

          CREATE TABLE IF NOT EXISTS subtopics (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            topic_id varchar NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            title text NOT NULL,
            description text,
            "order" integer NOT NULL DEFAULT 0,
            is_published boolean NOT NULL DEFAULT true,
            is_paid boolean NOT NULL DEFAULT false,
            estimated_minutes integer DEFAULT 3,
            created_at timestamp NOT NULL DEFAULT NOW(),
            updated_at timestamp NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_subtopics_topic_order ON subtopics(topic_id, "order");
          CREATE INDEX IF NOT EXISTS idx_subtopics_published ON subtopics(is_published);

          ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS subtopic_id varchar REFERENCES subtopics(id) ON DELETE CASCADE;
          ALTER TABLE content_blocks ALTER COLUMN topic_id DROP NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_content_blocks_subtopic ON content_blocks(subtopic_id);

          ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS subtopic_id varchar REFERENCES subtopics(id) ON DELETE CASCADE;
          ALTER TABLE user_progress ALTER COLUMN topic_id DROP NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_user_progress_user_subtopic ON user_progress(user_id, subtopic_id);

          ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS subtopic_id varchar REFERENCES subtopics(id) ON DELETE CASCADE;
          ALTER TABLE bookmarks ALTER COLUMN topic_id DROP NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_bookmarks_user_subtopic ON bookmarks(user_id, subtopic_id);
        `);
      } else {
        await db.execute(sql`
          ALTER TABLE topics ADD COLUMN IF NOT EXISTS book_id VARCHAR(255);
          CREATE TABLE IF NOT EXISTS subtopics (
            id VARCHAR(255) PRIMARY KEY,
            topic_id VARCHAR(255) NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            \`order\` INT NOT NULL DEFAULT 0,
            is_published BOOLEAN NOT NULL DEFAULT TRUE,
            is_paid BOOLEAN NOT NULL DEFAULT FALSE,
            estimated_minutes INT DEFAULT 3,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS subtopic_id VARCHAR(255);
          ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS subtopic_id VARCHAR(255);
          ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS subtopic_id VARCHAR(255);
        `);
      }
      console.log("[MIGRATION] Step 1 complete: DDL ensured.");
    } catch (err: any) {
      console.warn(`[MIGRATION] DDL warning (may already exist): ${err.message}`);
    }
  }

  // Step 2: Backfill topics.book_id from chapters.book_id
  console.log("[MIGRATION] Step 2: Backfilling topics.book_id from parent chapters...");
  const topicsWithoutBook = await db
    .select({
      topicId: topics.id,
      chapterId: topics.chapterId,
    })
    .from(topics)
    .where(isNull(topics.bookId));

  console.log(`[MIGRATION] Found ${topicsWithoutBook.length} topics without book_id.`);
  let backfilledTopicsCount = 0;

  if (topicsWithoutBook.length > 0) {
    const allChapters = await db.select({ id: chapters.id, bookId: chapters.bookId }).from(chapters);
    const chapterToBookMap = new Map<string, string>();
    for (const ch of allChapters) {
      chapterToBookMap.set(ch.id, ch.bookId);
    }

    for (const t of topicsWithoutBook) {
      if (t.chapterId && chapterToBookMap.has(t.chapterId)) {
        const bookId = chapterToBookMap.get(t.chapterId)!;
        if (!dryRun) {
          await db
            .update(topics)
            .set({ bookId })
            .where(eq(topics.id, t.topicId));
        }
        backfilledTopicsCount++;
      }
    }
    console.log(`[MIGRATION] Backfilled book_id for ${backfilledTopicsCount} topics.`);
  }

  // Step 3: Populate subtopics and link content blocks
  console.log("[MIGRATION] Step 3: Processing topics into subtopics...");
  const allTopics = await db.select().from(topics).orderBy(topics.order);
  console.log(`[MIGRATION] Total topics to check: ${allTopics.length}`);

  let totalSubtopicsCreated = 0;
  let totalBlocksAssigned = 0;

  for (const topic of allTopics) {
    // Check existing subtopics
    const existingSubtopics = await db
      .select()
      .from(subtopics)
      .where(eq(subtopics.topicId, topic.id))
      .orderBy(subtopics.order);

    if (existingSubtopics.length > 0) {
      // Subtopics already exist for this topic, ensure blocks are linked
      const unlinkedBlocks = await db
        .select()
        .from(contentBlocks)
        .where(and(eq(contentBlocks.topicId, topic.id), isNull(contentBlocks.subtopicId)));

      if (unlinkedBlocks.length > 0 && !dryRun) {
        const defaultSubtopic = existingSubtopics[0];
        for (const block of unlinkedBlocks) {
          await db
            .update(contentBlocks)
            .set({ subtopicId: defaultSubtopic.id })
            .where(eq(contentBlocks.id, block.id));
          totalBlocksAssigned++;
        }
      }
      continue;
    }

    // Fetch all blocks for this topic
    const blocks = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.topicId, topic.id))
      .orderBy(contentBlocks.order);

    if (blocks.length === 0) {
      // Topic has no blocks, create 1 empty default subtopic
      if (!dryRun) {
        await db.insert(subtopics).values({
          id: crypto.randomUUID(),
          topicId: topic.id,
          title: topic.title || "Overview",
          description: topic.description,
          order: 0,
          isPublished: topic.isPublished ?? true,
          isPaid: topic.isPaid ?? false,
          estimatedMinutes: 3,
        });
      }
      totalSubtopicsCreated++;
      continue;
    }

    // Partition blocks by headings
    interface SubtopicSection {
      title: string;
      blocks: typeof blocks;
    }

    const sections: SubtopicSection[] = [];
    let currentSection: SubtopicSection = {
      title: "Overview",
      blocks: [],
    };

    for (const block of blocks) {
      const heading = extractHeading(block);
      if (heading) {
        if (currentSection.blocks.length > 0) {
          sections.push(currentSection);
          currentSection = {
            title: heading,
            blocks: [block],
          };
        } else {
          currentSection.title = heading;
          currentSection.blocks.push(block);
        }
      } else {
        currentSection.blocks.push(block);
      }
    }

    if (currentSection.blocks.length > 0) {
      sections.push(currentSection);
    }

    // If only 1 section was formed and title was 'Overview', name it after the topic
    if (sections.length === 1 && sections[0].title === "Overview") {
      sections[0].title = topic.title || "Overview";
    }

    // Insert subtopics and update content blocks
    let subOrder = 0;
    for (const section of sections) {
      let subtopicId = crypto.randomUUID();
      const estimatedMinutes = Math.max(
        2,
        Math.min(15, Math.ceil(section.blocks.reduce((acc: number, b: any) => acc + (b.content?.length || 0), 0) / 1200))
      );

      if (!dryRun) {
        await db
          .insert(subtopics)
          .values({
            id: subtopicId,
            topicId: topic.id,
            title: section.title,
            description: null,
            order: subOrder++,
            isPublished: topic.isPublished ?? true,
            isPaid: topic.isPaid ?? false,
            estimatedMinutes,
          });

        for (const block of section.blocks) {
          await db
            .update(contentBlocks)
            .set({ subtopicId })
            .where(eq(contentBlocks.id, block.id));
          totalBlocksAssigned++;
        }
      } else {
        subOrder++;
        totalBlocksAssigned += section.blocks.length;
      }
      totalSubtopicsCreated++;
    }
  }

  console.log(`[MIGRATION] Created ${totalSubtopicsCreated} subtopics across all topics.`);
  console.log(`[MIGRATION] Assigned ${totalBlocksAssigned} content blocks to subtopics.`);

  // Step 4: Backfill user_progress for subtopics
  console.log("[MIGRATION] Step 4: Backfilling user_progress for subtopics...");
  const completedTopicProgress = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.isCompleted, true), isNull(userProgress.subtopicId)));

  console.log(`[MIGRATION] Found ${completedTopicProgress.length} completed topic progress records.`);
  let subtopicProgressCreated = 0;

  for (const prog of completedTopicProgress) {
    if (!prog.topicId) continue;
    const topicSubtopics = await db
      .select({ id: subtopics.id })
      .from(subtopics)
      .where(eq(subtopics.topicId, prog.topicId));

    for (const sub of topicSubtopics) {
      if (!dryRun) {
        const [existing] = await db
          .select()
          .from(userProgress)
          .where(and(eq(userProgress.userId, prog.userId), eq(userProgress.subtopicId, sub.id)));

        if (!existing) {
          await db.insert(userProgress).values({
            id: crypto.randomUUID(),
            userId: prog.userId,
            topicId: prog.topicId,
            subtopicId: sub.id,
            isCompleted: true,
            completedAt: prog.completedAt || new Date(),
          });
          subtopicProgressCreated++;
        }
      } else {
        subtopicProgressCreated++;
      }
    }
  }
  console.log(`[MIGRATION] Backfilled ${subtopicProgressCreated} subtopic progress records.`);

  // Step 5: Backfill bookmarks for subtopics
  console.log("[MIGRATION] Step 5: Backfilling bookmarks for subtopics...");
  const topicBookmarks = await db
    .select()
    .from(bookmarks)
    .where(isNull(bookmarks.subtopicId));

  console.log(`[MIGRATION] Found ${topicBookmarks.length} topic bookmarks.`);
  let subtopicBookmarksCreated = 0;

  for (const bm of topicBookmarks) {
    if (!bm.topicId) continue;
    const [firstSub] = await db
      .select({ id: subtopics.id })
      .from(subtopics)
      .where(eq(subtopics.topicId, bm.topicId))
      .orderBy(subtopics.order)
      .limit(1);

    if (firstSub) {
      if (!dryRun) {
        await db
          .update(bookmarks)
          .set({ subtopicId: firstSub.id })
          .where(eq(bookmarks.id, bm.id));
      }
      subtopicBookmarksCreated++;
    }
  }
  console.log(`[MIGRATION] Linked ${subtopicBookmarksCreated} bookmarks to first subtopics.`);
  console.log("[MIGRATION] Migration complete successfully!");
}

if (process.argv[1]?.includes("migrate-to-subtopics")) {
  const isDryRun = process.argv.includes("--dry-run");
  migrateToSubtopics({ dryRun: isDryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[MIGRATION ERROR]", err);
      process.exit(1);
    });
}
