import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";
import {
  getOptionTextByLabel,
  normalizeOptions,
  resolveAnswerLabel,
  resolveCorrectLabel,
} from "../lib/mcq-options";
import { logger } from "../lib/logger";

const router = Router();

// Get due reviews count (for badge on home screen)
router.get("/due-count", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = await storage.getDueReviewCount(req.userId!);
    res.json({ count });
  } catch (error) {
    logger.error("Get due review count error", { error: String(error) });
    res.status(500).json({ message: "Failed to get due review count" });
  }
});

// Get due review cards with MCQ details
router.get("/due", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const dueReviews = await storage.getDueReviews(req.userId!, limit);

    if (dueReviews.length === 0) {
      return res.json({ reviews: [], questions: [] });
    }

    // Batch-fetch MCQ details
    const mcqIds = dueReviews.map((r) => r.mcqId);
    const allMcqs = await storage.getMCQsByIds(mcqIds);
    const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));
    const metaMap = await storage.getMCQMetadataByIds(mcqIds);

    const questions = dueReviews
      .map((review) => {
        const mcq = mcqMap.get(review.mcqId);
        if (!mcq) return null;
        const meta = metaMap.get(review.mcqId);
        return {
          reviewId: review.id,
          mcqId: mcq.id,
          question: mcq.question,
          options: normalizeOptions(mcq.options),
          difficulty: mcq.difficulty,
          interval: review.interval,
          repetitions: review.repetitions,
          year: meta?.year ?? null,
          sourceName: meta?.sourceName ?? null,
          subjectName: meta?.subjectName ?? null,
        };
      })
      .filter(Boolean);

    res.json({ questions });
  } catch (error) {
    logger.error("Get due reviews error", { error: String(error) });
    res.status(500).json({ message: "Failed to get due reviews" });
  }
});

// Submit a review result (SM-2 quality rating)
router.post("/submit", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { reviewId, mcqId, selectedAnswer, quality } = req.body as {
      reviewId?: string;
      mcqId?: string;
      selectedAnswer?: string;
      quality?: number;
    };

    if (!reviewId && !mcqId) {
      return res.status(400).json({ message: "reviewId or mcqId is required" });
    }

    // If no reviewId, create one on the fly
    let actualReviewId = reviewId;
    if (!actualReviewId && mcqId) {
      const review = await storage.getOrCreateReview(req.userId!, mcqId);
      actualReviewId = review.id;
    }

    if (!actualReviewId) {
      return res.status(400).json({ message: "reviewId or mcqId required" });
    }

    // Get the MCQ to check the answer
    const review = await storage.getDueReviews(req.userId!, 100);
    const thisReview = review.find((r) => r.id === actualReviewId);
    const mcq = thisReview
      ? await storage.getMCQ(thisReview.mcqId)
      : mcqId
        ? await storage.getMCQ(mcqId)
        : null;

    if (!mcq) {
      return res.status(404).json({ message: "MCQ not found" });
    }

    const hasExplicitQuality =
      typeof quality === "number" &&
      Number.isFinite(quality) &&
      quality >= 0 &&
      quality <= 5;

    if (!hasExplicitQuality && typeof selectedAnswer !== "string") {
      return res.status(400).json({
        message: "Either quality or selectedAnswer is required",
      });
    }

    const selectedLabel =
      typeof selectedAnswer === "string"
        ? resolveAnswerLabel(selectedAnswer, mcq.options)
        : "";
    const correctLabel = resolveCorrectLabel(mcq.correctAnswer, mcq.options);
    const isCorrect = selectedLabel === correctLabel;

    // Prefer explicit client-provided quality for spaced-repetition,
    // fallback to correctness mapping for legacy callers.
    const normalizedQuality = hasExplicitQuality ? quality : isCorrect ? 4 : 1;

    const updated = await storage.updateReview(
      actualReviewId,
      normalizedQuality,
    );

    res.json({
      isCorrect,
      correctAnswer: correctLabel,
      correctAnswerText: getOptionTextByLabel(correctLabel, mcq.options),
      explanation: mcq.explanation,
      nextReviewAt: updated.nextReviewAt.toISOString(),
      interval: updated.interval,
    });
  } catch (error) {
    logger.error("Submit review error", { error: String(error) });
    res.status(500).json({ message: "Failed to submit review" });
  }
});

// Enqueue wrong answers from a quiz attempt for spaced repetition
router.post("/enqueue", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { attemptId } = req.body;

    const attempt = await storage.getQuizAttempt(attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const answers = attempt.answers as Record<string, { isCorrect: boolean }>;

    let enqueued = 0;
    for (const [mcqId, answer] of Object.entries(answers)) {
      if (!answer.isCorrect) {
        await storage.getOrCreateReview(req.userId!, mcqId);
        enqueued++;
      }
    }

    res.json({
      enqueued,
      message: `${enqueued} questions added to review queue`,
    });
  } catch (error) {
    logger.error("Enqueue reviews error", { error: String(error) });
    res.status(500).json({ message: "Failed to enqueue reviews" });
  }
});

export default router;
