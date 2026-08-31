import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";
import { normalizeOptions, resolveAnswerLabel } from "../lib/mcq-options";
import { logger } from "../lib/logger";

const router = Router();

// Attempt History with filters
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const {
      mode,
      topicId,
      startDate,
      endDate,
      page: pageParam,
      pageSize: pageSizeParam,
    } = req.query;
    const usePagination =
      pageParam !== undefined || pageSizeParam !== undefined;
    const page = Math.max(1, parseInt(pageParam as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSizeParam as string) || 20),
    );

    let attempts: Awaited<ReturnType<typeof storage.getQuizAttempts>>;
    let total: number | undefined;

    if (usePagination && !mode && !topicId && !startDate && !endDate) {
      // Fast path: no filters, use DB-level pagination
      const result = await storage.getQuizAttemptsPaginated(
        req.userId!,
        page,
        pageSize,
      );
      attempts = result.data;
      total = result.total;
    } else {
      // Filters require in-memory processing
      const allAttempts = await storage.getQuizAttempts(req.userId!);
      let filteredAttempts = allAttempts;

      if (mode && mode !== "all") {
        filteredAttempts = filteredAttempts.filter((a) => a.mode === mode);
      }

      if (topicId) {
        filteredAttempts = filteredAttempts.filter(
          (a) => a.topicId === topicId,
        );
      }

      if (startDate) {
        const start = new Date(startDate as string);
        filteredAttempts = filteredAttempts.filter(
          (a) => new Date(a.createdAt) >= start,
        );
      }

      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filteredAttempts = filteredAttempts.filter(
          (a) => new Date(a.createdAt) <= end,
        );
      }

      total = filteredAttempts.length;

      if (usePagination) {
        const offset = (page - 1) * pageSize;
        attempts = filteredAttempts.slice(offset, offset + pageSize);
      } else {
        attempts = filteredAttempts;
      }
    }

    // Batch-fetch all unique topic titles instead of N+1 queries
    const uniqueTopicIds = [
      ...new Set(attempts.map((a) => a.topicId).filter(Boolean)),
    ] as string[];
    const topicTitleMap = new Map<string, string>();
    for (const tid of uniqueTopicIds) {
      const topic = await storage.getTopic(tid);
      if (topic) topicTitleMap.set(tid, topic.title);
    }

    const attemptsWithDetails = attempts.map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      timeTaken: a.timeTaken,
      mode: a.mode,
      topicId: a.topicId,
      topicTitle: a.topicId ? topicTitleMap.get(a.topicId) : undefined,
    }));

    if (usePagination) {
      const totalPages = Math.ceil((total ?? 0) / pageSize);
      res.json({
        data: attemptsWithDetails,
        pagination: { total: total ?? 0, page, pageSize, totalPages },
      });
    } else {
      res.json(attemptsWithDetails);
    }
  } catch (error) {
    logger.error("Get attempts error", { error: String(error) });
    res.status(500).json({ message: "Failed to get attempts" });
  }
});

// Single Attempt Detail
router.get("/:attemptId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { attemptId } = req.params as { attemptId: string };
    const attempt = await storage.getQuizAttempt(attemptId);

    if (!attempt || attempt.userId !== req.userId) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    let topicTitle = undefined;
    if (attempt.topicId) {
      const topic = await storage.getTopic(attempt.topicId);
      topicTitle = topic?.title;
    }

    const answersData = attempt.answers as Record<
      string,
      {
        selected?: string;
        correct?: string;
        selectedText?: string;
        correctText?: string;
        isCorrect?: boolean;
      }
    >;
    const questionIds = Object.keys(answersData);

    // Batch-fetch all MCQs in one query
    const allMcqs = await storage.getMCQsByIds(questionIds);
    const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));
    const metaMap = await storage.getMCQMetadataByIds(questionIds);

    const questionsWithDetails = questionIds.map((qId) => {
      const mcq = mcqMap.get(qId);
      const answerInfo = answersData[qId] || {};
      const meta = metaMap.get(qId);
      const options = normalizeOptions(mcq?.options);
      const selectedAnswer = resolveAnswerLabel(
        String(answerInfo.selected || answerInfo.selectedText || ""),
        mcq?.options,
      );
      const correctAnswer = resolveAnswerLabel(
        String(answerInfo.correct || answerInfo.correctText || ""),
        mcq?.options,
      );

      return {
        id: qId,
        question: mcq?.question || "Question not found",
        options,
        selectedAnswer,
        correctAnswer,
        isCorrect: Boolean(answerInfo.isCorrect),
        explanation: mcq?.explanation || "",
        images: (mcq?.images as unknown[] | null) ?? [],
        year: meta?.year ?? null,
        sourceName: meta?.sourceName ?? null,
        subjectName: meta?.subjectName ?? null,
      };
    });

    res.json({
      id: attempt.id,
      date: attempt.createdAt.toISOString(),
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      timeTaken: attempt.timeTaken,
      mode: attempt.mode,
      topicId: attempt.topicId,
      topicTitle,
      questions: questionsWithDetails,
    });
  } catch (error) {
    logger.error("Get attempt detail error", { error: String(error) });
    res.status(500).json({ message: "Failed to get attempt detail" });
  }
});

export default router;
