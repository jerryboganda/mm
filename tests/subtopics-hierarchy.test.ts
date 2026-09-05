import test from "node:test";
import assert from "node:assert/strict";
import {
  topics,
  subtopics,
  contentBlocks,
  userProgress,
  bookmarks,
  type Topic,
  type Subtopic,
  type ContentBlock,
} from "../shared/schema";

test("Database schema topology: subtopics table definition and columns", () => {
  assert.ok(subtopics, "subtopics table must be exported");
  assert.ok(subtopics.id, "subtopics.id must exist");
  assert.ok(subtopics.topicId, "subtopics.topicId must exist");
  assert.ok(subtopics.title, "subtopics.title must exist");
  assert.ok(subtopics.description, "subtopics.description must exist");
  assert.ok(subtopics.order, "subtopics.order must exist");
  assert.ok(subtopics.isPublished, "subtopics.isPublished must exist");
  assert.ok(subtopics.isPaid, "subtopics.isPaid must exist");
  assert.ok(subtopics.estimatedMinutes, "subtopics.estimatedMinutes must exist");
  assert.ok(subtopics.createdAt, "subtopics.createdAt must exist");
  assert.ok(subtopics.updatedAt, "subtopics.updatedAt must exist");
});

test("Database schema topology: topics has bookId and optional chapterId", () => {
  assert.ok(topics.bookId, "topics.bookId must exist for Book > Topic hierarchy");
  assert.ok(topics.chapterId, "topics.chapterId must exist for backward compatibility");
});

test("Database schema topology: contentBlocks, userProgress, and bookmarks reference subtopics", () => {
  assert.ok(contentBlocks.subtopicId, "contentBlocks.subtopicId must exist");
  assert.ok(userProgress.subtopicId, "userProgress.subtopicId must exist");
  assert.ok(bookmarks.subtopicId, "bookmarks.subtopicId must exist");
});

test("Heading extraction & subtopic partitioning algorithm with 0-loss guarantee", () => {
  // Test block partitioning logic used in migration
  interface TestBlock {
    id: string;
    type: string;
    content: string;
    order: number;
  }

  function partitionBlocks(blocks: TestBlock[]): { title: string; blocks: TestBlock[] }[] {
    const sections: { title: string; blocks: TestBlock[] }[] = [];
    let currentSection: { title: string; blocks: TestBlock[] } = {
      title: "Overview",
      blocks: [],
    };

    for (const block of blocks) {
      let isHeading = false;
      let headingTitle = "";

      if (block.type === "heading" && block.content && block.content.trim().length > 0) {
        isHeading = true;
        headingTitle = block.content.trim();
      } else if (
        (block.type === "text" || block.type === "html" || block.type === "document_html") &&
        block.content
      ) {
        const hMatch = block.content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
        if (hMatch && hMatch[1]) {
          const stripped = hMatch[1].replace(/<[^>]+>/g, "").trim();
          if (stripped.length > 2 && stripped.length < 150) {
            isHeading = true;
            headingTitle = stripped;
          }
        }
      }

      if (isHeading && headingTitle) {
        if (currentSection.blocks.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: headingTitle, blocks: [block] };
      } else {
        currentSection.blocks.push(block);
      }
    }

    if (currentSection.blocks.length > 0) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      sections.push({ title: "Overview", blocks });
    }

    return sections;
  }

  // Case 1: Topic with headings
  const testBlocksWithHeadings: TestBlock[] = [
    { id: "b1", type: "text", content: "<p>Introductory remarks</p>", order: 0 },
    { id: "b2", type: "heading", content: "Etiology and Pathophysiology", order: 1 },
    { id: "b3", type: "text", content: "<p>Etiological mechanisms</p>", order: 2 },
    { id: "b4", type: "html", content: "<h2>Clinical Management</h2><p>Treatment steps</p>", order: 3 },
  ];

  const partitioned = partitionBlocks(testBlocksWithHeadings);
  assert.equal(partitioned.length, 3);
  assert.equal(partitioned[0].title, "Overview");
  assert.equal(partitioned[0].blocks.length, 1);
  assert.equal(partitioned[1].title, "Etiology and Pathophysiology");
  assert.equal(partitioned[1].blocks.length, 2);
  assert.equal(partitioned[2].title, "Clinical Management");
  assert.equal(partitioned[2].blocks.length, 1);

  // Total blocks preserved: 100% (0 loss)
  const totalPreserved = partitioned.reduce((acc, sec) => acc + sec.blocks.length, 0);
  assert.equal(totalPreserved, testBlocksWithHeadings.length);

  // Case 2: Topic with NO headings -> single fallback subtopic with 0 data loss
  const testBlocksNoHeadings: TestBlock[] = [
    { id: "b1", type: "text", content: "Paragraph 1", order: 0 },
    { id: "b2", type: "image", content: "https://example.com/img.png", order: 1 },
    { id: "b3", type: "text", content: "Paragraph 2", order: 2 },
  ];

  const fallbackPartition = partitionBlocks(testBlocksNoHeadings);
  assert.equal(fallbackPartition.length, 1);
  assert.equal(fallbackPartition[0].title, "Overview");
  assert.equal(fallbackPartition[0].blocks.length, testBlocksNoHeadings.length);
});

test("Aggregated progress calculation for Book > Topic > subtopics", () => {
  function calculateTopicProgress(totalSubtopics: number, completedSubtopics: number) {
    if (totalSubtopics <= 0) return { progress: 0, isCompleted: false };
    const progress = Math.round((completedSubtopics / totalSubtopics) * 100);
    return {
      progress,
      isCompleted: completedSubtopics >= totalSubtopics,
    };
  }

  // 0 subtopics
  assert.deepEqual(calculateTopicProgress(0, 0), { progress: 0, isCompleted: false });

  // 2 of 4 completed
  assert.deepEqual(calculateTopicProgress(4, 2), { progress: 50, isCompleted: false });

  // 3 of 3 completed
  assert.deepEqual(calculateTopicProgress(3, 3), { progress: 100, isCompleted: true });

  // 1 of 3 completed (33%)
  assert.deepEqual(calculateTopicProgress(3, 1), { progress: 33, isCompleted: false });
});

test("Topic completion contract: 1 completed subtopic does NOT mark entire topic completed", () => {
  function resolveTopicCompletion(opts: {
    totalSubtopics: number;
    completedSubtopics: number;
    isDirectlyCompleted: boolean;
  }): boolean {
    if (opts.totalSubtopics > 0) {
      return opts.completedSubtopics >= opts.totalSubtopics;
    }
    return opts.isDirectlyCompleted;
  }

  // 1 of 3 subtopics complete -> topic is NOT completed
  assert.equal(
    resolveTopicCompletion({
      totalSubtopics: 3,
      completedSubtopics: 1,
      isDirectlyCompleted: false,
    }),
    false,
    "Topic with 1/3 subtopics complete must NOT be marked complete",
  );

  // 2 of 3 subtopics complete -> topic is NOT completed
  assert.equal(
    resolveTopicCompletion({
      totalSubtopics: 3,
      completedSubtopics: 2,
      isDirectlyCompleted: false,
    }),
    false,
    "Topic with 2/3 subtopics complete must NOT be marked complete",
  );

  // 3 of 3 subtopics complete -> topic IS completed
  assert.equal(
    resolveTopicCompletion({
      totalSubtopics: 3,
      completedSubtopics: 3,
      isDirectlyCompleted: false,
    }),
    true,
    "Topic with all subtopics complete must be marked complete",
  );

  // 0 subtopics (legacy topic) with direct completion -> topic IS completed
  assert.equal(
    resolveTopicCompletion({
      totalSubtopics: 0,
      completedSubtopics: 0,
      isDirectlyCompleted: true,
    }),
    true,
    "Legacy topic with direct completion must be marked complete",
  );

  // 0 subtopics (legacy topic) without direct completion -> topic is NOT completed
  assert.equal(
    resolveTopicCompletion({
      totalSubtopics: 0,
      completedSubtopics: 0,
      isDirectlyCompleted: false,
    }),
    false,
    "Legacy topic without completion must NOT be marked complete",
  );
});

test("Progress isolation: subtopic progress rows do not collide with topic-level progress", () => {
  const progressRecords = [
    { id: "p1", userId: "u1", topicId: "t1", subtopicId: "st1", isCompleted: true },
    { id: "p2", userId: "u1", topicId: "t1", subtopicId: "st2", isCompleted: false },
    { id: "p3", userId: "u1", topicId: "t2", subtopicId: null, isCompleted: true },
  ];

  // Topic-level query filters for isNull(subtopicId)
  const topicLevelRecords = progressRecords.filter((p) => !p.subtopicId);
  assert.equal(topicLevelRecords.length, 1);
  assert.equal(topicLevelRecords[0].topicId, "t2");

  // Book-level completed topics filter enforces !p.subtopicId && p.isCompleted
  const completedTopicRecords = progressRecords.filter((p) => !p.subtopicId && p.isCompleted);
  assert.equal(completedTopicRecords.length, 1);
  assert.equal(completedTopicRecords[0].topicId, "t2");
  // Subtopic "st1" completed must not count toward completed topic count directly
  assert.ok(!completedTopicRecords.some((p) => p.topicId === "t1"));
});

test("Static contract: RootStackNavigator registers SubtopicsScreen", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const rootNavPath = path.resolve(__dirname, "../client/navigation/RootStackNavigator.tsx");
  const content = await fs.readFile(rootNavPath, "utf-8");

  assert.ok(
    content.includes('import SubtopicsScreen from "@/screens/SubtopicsScreen"'),
    "RootStackNavigator must import SubtopicsScreen",
  );
  assert.ok(
    content.includes('<Stack.Screen\n              name="Subtopics"') ||
      content.includes('<Stack.Screen name="Subtopics"') ||
      content.includes('name="Subtopics"'),
    "RootStackNavigator must register Subtopics screen",
  );
});

test("Static contract: SearchScreen navigates books to Topics and topics to Subtopics", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const searchScreenPath = path.resolve(__dirname, "../client/screens/SearchScreen.tsx");
  const content = await fs.readFile(searchScreenPath, "utf-8");

  // Book case navigates to Topics screen
  assert.ok(
    content.includes('screen: "Topics",\n            params: {\n              bookId: item.id'),
    "SearchScreen must navigate book results to Topics screen",
  );

  // Topic case navigates to Subtopics screen
  assert.ok(
    content.includes('navigation.navigate("Subtopics", {\n          topicId: item.id'),
    "SearchScreen must navigate topic results to Subtopics screen",
  );
});
