import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { storage } from "./storage";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { z } from "zod";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const JWT_SECRET = process.env.SESSION_SECRET || "maternal-mind-secret-key";
const JWT_EXPIRES_IN = "7d";

interface AuthRequest extends Request {
  userId?: string;
}

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }

  req.userId = decoded.userId;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        name: data.name,
      });

      const accessToken = generateToken(user.id);
      
      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPlan: user.subscriptionPlan,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const accessToken = generateToken(user.id);
      
      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPlan: user.subscriptionPlan,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        // Return success even if user not found to prevent email enumeration
        return res.json({ message: "If an account exists with this email, a reset link has been sent." });
      }

      const token = await storage.createPasswordResetToken(user.id);
      
      // Get the app domain for the reset link
      const appDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      const resetLink = `https://${appDomain}/reset-password?token=${token}`;

      if (resend) {
        try {
          await resend.emails.send({
            from: "Maternal Mind <noreply@maternalmind.app>",
            to: user.email,
            subject: "Reset Your Password - Maternal Mind",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #11a4d4;">Reset Your Password</h1>
                <p>Hello ${user.name},</p>
                <p>You requested to reset your password for Maternal Mind. Click the button below to set a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background: #11a4d4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Email send error:", emailError);
          // Still return success to prevent email enumeration
        }
      } else {
        // Development mode - log the reset link
        console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
      }

      res.json({ message: "If an account exists with this email, a reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return res.json({ message: "If an account exists with this email, a verification link has been sent." });
      }

      // In production, send verification email via Resend
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          
          await resend.emails.send({
            from: "Maternal Mind <noreply@maternalmind.app>",
            to: [email],
            subject: "Verify your email - Maternal Mind",
            html: `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #11a4d4; margin-bottom: 20px;">Verify Your Email</h1>
                <p style="color: #333; font-size: 16px; line-height: 24px;">
                  Thank you for signing up for Maternal Mind! Please verify your email to access all features.
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  If you didn't create an account, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Email send error:", emailError);
        }
      } else {
        console.log(`[DEV] Verification email would be sent to ${email}`);
      }

      res.json({ message: "If an account exists with this email, a verification link has been sent." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to send verification email" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);
      
      const resetToken = await storage.getPasswordResetToken(data.token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      await storage.markTokenUsed(resetToken.id);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (_req, res) => {
    res.json({ success: true });
  });

  app.get("/api/books", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const booksData = await storage.getBooks();
      const userProgressData = await storage.getUserProgress(req.userId!);

      const booksWithProgress = await Promise.all(
        booksData.map(async (book) => {
          const chaptersData = await storage.getChaptersByBook(book.id);
          let totalTopics = 0;
          let completedTopics = 0;

          for (const chapter of chaptersData) {
            const topicsData = await storage.getTopicsByChapter(chapter.id);
            totalTopics += topicsData.length;
            completedTopics += topicsData.filter(t =>
              userProgressData.some(p => p.topicId === t.id && p.isCompleted)
            ).length;
          }

          return {
            id: book.id,
            title: book.title,
            description: book.description,
            imageUrl: book.imageUrl,
            chaptersCount: chaptersData.length,
            progress: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
          };
        })
      );

      res.json(booksWithProgress);
    } catch (error) {
      console.error("Get books error:", error);
      res.status(500).json({ message: "Failed to get books" });
    }
  });

  app.get("/api/books/:bookId/chapters", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { bookId } = req.params;
      const chaptersData = await storage.getChaptersByBook(bookId);
      const userProgressData = await storage.getUserProgress(req.userId!);

      const chaptersWithProgress = await Promise.all(
        chaptersData.map(async (chapter) => {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          const completedTopics = topicsData.filter(t =>
            userProgressData.some(p => p.topicId === t.id && p.isCompleted)
          ).length;

          return {
            id: chapter.id,
            title: chapter.title,
            description: chapter.description,
            topicsCount: topicsData.length,
            progress: topicsData.length > 0 ? Math.round((completedTopics / topicsData.length) * 100) : 0,
            order: chapter.order,
          };
        })
      );

      res.json(chaptersWithProgress);
    } catch (error) {
      console.error("Get chapters error:", error);
      res.status(500).json({ message: "Failed to get chapters" });
    }
  });

  app.get("/api/chapters/:chapterId/topics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { chapterId } = req.params;
      const topicsData = await storage.getTopicsByChapter(chapterId);
      const userProgressData = await storage.getUserProgress(req.userId!);
      const userBookmarks = await storage.getBookmarks(req.userId!);

      const topicsWithStatus = topicsData.map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        order: topic.order,
        isCompleted: userProgressData.some(p => p.topicId === topic.id && p.isCompleted),
        isBookmarked: userBookmarks.some(b => b.topicId === topic.id),
      }));

      res.json(topicsWithStatus);
    } catch (error) {
      console.error("Get topics error:", error);
      res.status(500).json({ message: "Failed to get topics" });
    }
  });

  app.get("/api/topics/:topicId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params;
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const blocks = await storage.getContentBlocksByTopic(topicId);
      const progress = await storage.getTopicProgress(req.userId!, topicId);
      const isBookmarked = await storage.isBookmarked(req.userId!, topicId);

      const allTopics = await storage.getTopicsByChapter(topic.chapterId);
      const currentIndex = allTopics.findIndex(t => t.id === topicId);
      const previousTopicId = currentIndex > 0 ? allTopics[currentIndex - 1].id : undefined;
      const nextTopicId = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1].id : undefined;

      res.json({
        id: topic.id,
        title: topic.title,
        isCompleted: progress?.isCompleted || false,
        isBookmarked,
        blocks: blocks.map(b => ({
          id: b.id,
          type: b.type,
          content: b.content,
          order: b.order,
        })),
        previousTopicId,
        nextTopicId,
      });
    } catch (error) {
      console.error("Get topic error:", error);
      res.status(500).json({ message: "Failed to get topic" });
    }
  });

  app.post("/api/topics/:topicId/complete", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params;
      await storage.markTopicComplete(req.userId!, topicId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark complete error:", error);
      res.status(500).json({ message: "Failed to mark topic complete" });
    }
  });

  app.post("/api/topics/:topicId/bookmark", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params;
      const isBookmarked = await storage.toggleBookmark(req.userId!, topicId);
      res.json({ isBookmarked });
    } catch (error) {
      console.error("Toggle bookmark error:", error);
      res.status(500).json({ message: "Failed to toggle bookmark" });
    }
  });

  app.get("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userBookmarks = await storage.getBookmarks(req.userId!);
      
      const bookmarksWithDetails = await Promise.all(
        userBookmarks.map(async (bookmark) => {
          const topic = await storage.getTopic(bookmark.topicId);
          if (!topic) return null;

          const chapter = await storage.getChapter(topic.chapterId);
          if (!chapter) return null;

          const book = await storage.getBook(chapter.bookId);
          if (!book) return null;

          return {
            id: bookmark.id,
            topicId: topic.id,
            topicTitle: topic.title,
            chapterTitle: chapter.title,
            bookTitle: book.title,
            createdAt: bookmark.createdAt.toISOString(),
          };
        })
      );

      res.json(bookmarksWithDetails.filter(Boolean));
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({ message: "Failed to get bookmarks" });
    }
  });

  // Search API
  app.get("/api/search", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const query = (req.query.query as string || "").toLowerCase().trim();
      const filter = req.query.filter as string || "all";

      if (query.length < 2) {
        return res.json([]);
      }

      const results: {
        id: string;
        type: "book" | "chapter" | "topic";
        title: string;
        subtitle: string;
        bookId?: string;
        bookTitle?: string;
        chapterId?: string;
        chapterTitle?: string;
      }[] = [];

      const booksData = await storage.getBooks();

      for (const book of booksData) {
        // Search books
        if (filter === "all" || filter === "books") {
          if (book.title.toLowerCase().includes(query) || 
              (book.description && book.description.toLowerCase().includes(query))) {
            results.push({
              id: book.id,
              type: "book",
              title: book.title,
              subtitle: book.description || "Book",
            });
          }
        }

        const chaptersData = await storage.getChaptersByBook(book.id);

        for (const chapter of chaptersData) {
          // Search chapters
          if (filter === "all" || filter === "chapters") {
            if (chapter.title.toLowerCase().includes(query) ||
                (chapter.description && chapter.description.toLowerCase().includes(query))) {
              results.push({
                id: chapter.id,
                type: "chapter",
                title: chapter.title,
                subtitle: book.title,
                bookId: book.id,
                bookTitle: book.title,
              });
            }
          }

          // Search topics
          if (filter === "all" || filter === "topics") {
            const topicsData = await storage.getTopicsByChapter(chapter.id);
            for (const topic of topicsData) {
              if (topic.title.toLowerCase().includes(query) ||
                  (topic.description && topic.description.toLowerCase().includes(query))) {
                results.push({
                  id: topic.id,
                  type: "topic",
                  title: topic.title,
                  subtitle: `${book.title} > ${chapter.title}`,
                  bookId: book.id,
                  bookTitle: book.title,
                  chapterId: chapter.id,
                  chapterTitle: chapter.title,
                });
              }
            }
          }
        }
      }

      // Limit results
      res.json(results.slice(0, 50));
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/quiz/stats", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getQuizStats(req.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Get quiz stats error:", error);
      res.status(500).json({ message: "Failed to get quiz stats" });
    }
  });

  app.get("/api/quiz/topics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const booksData = await storage.getBooks();
      const quizTopics: { id: string; title: string; chapterTitle: string; questionCount: number }[] = [];

      for (const book of booksData) {
        const chaptersData = await storage.getChaptersByBook(book.id);
        for (const chapter of chaptersData) {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          for (const topic of topicsData) {
            const mcqsData = await storage.getMCQsByTopic(topic.id);
            if (mcqsData.length > 0) {
              quizTopics.push({
                id: topic.id,
                title: topic.title,
                chapterTitle: chapter.title,
                questionCount: mcqsData.length,
              });
            }
          }
        }
      }

      res.json(quizTopics);
    } catch (error) {
      console.error("Get quiz topics error:", error);
      res.status(500).json({ message: "Failed to get quiz topics" });
    }
  });

  app.get("/api/quiz/start/:mode", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { mode } = req.params;
      const topicId = req.query.topicId as string | undefined;
      let questions: any[] = [];

      if (mode === "topic" && topicId) {
        questions = await storage.getMCQsByTopic(topicId);
      } else if (mode === "wrong") {
        questions = await storage.getWrongQuestions(req.userId!);
      } else {
        questions = await storage.getMCQs(10);
      }

      const shuffledQuestions = questions
        .sort(() => Math.random() - 0.5)
        .slice(0, 10)
        .map(q => ({
          id: q.id,
          question: q.question,
          options: q.options as { label: string; text: string }[],
          difficulty: q.difficulty,
        }));

      res.json({
        quizId: `quiz-${Date.now()}`,
        questions: shuffledQuestions,
        timeLimit: 10,
      });
    } catch (error) {
      console.error("Start quiz error:", error);
      res.status(500).json({ message: "Failed to start quiz" });
    }
  });

  app.post("/api/quiz/submit", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { quizId, answers, mode, topicId } = req.body;
      const answerEntries = Object.entries(answers as Record<string, string>);
      
      let correctCount = 0;
      const detailedAnswers: Record<string, any> = {};

      for (const [mcqId, selectedAnswer] of answerEntries) {
        const mcq = await storage.getMCQ(mcqId);
        if (mcq) {
          const isCorrect = selectedAnswer === mcq.correctAnswer;
          if (isCorrect) correctCount++;
          detailedAnswers[mcqId] = {
            selected: selectedAnswer,
            correct: mcq.correctAnswer,
            isCorrect,
            explanation: mcq.explanation,
          };
        }
      }

      const totalQuestions = answerEntries.length;
      const wrongCount = totalQuestions - correctCount;
      const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      const attempt = await storage.createQuizAttempt({
        userId: req.userId!,
        topicId: topicId || null,
        mode: mode || "mixed",
        score,
        totalQuestions,
        correctCount,
        wrongCount,
        timeTaken: 0,
        answers: detailedAnswers,
      });

      res.json({ id: attempt.id });
    } catch (error) {
      console.error("Submit quiz error:", error);
      res.status(500).json({ message: "Failed to submit quiz" });
    }
  });

  app.get("/api/quiz/results/:resultId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { resultId } = req.params;
      const attempt = await storage.getQuizAttempt(resultId);
      if (!attempt) {
        return res.status(404).json({ message: "Result not found" });
      }

      const answers = attempt.answers as Record<string, any>;
      const questions = await Promise.all(
        Object.entries(answers).map(async ([mcqId, answer]) => {
          const mcq = await storage.getMCQ(mcqId);
          return {
            id: mcqId,
            question: mcq?.question || "Question not found",
            selectedAnswer: answer.selected,
            correctAnswer: answer.correct,
            isCorrect: answer.isCorrect,
            explanation: answer.explanation || mcq?.explanation || "",
          };
        })
      );

      res.json({
        id: attempt.id,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        timeTaken: attempt.timeTaken || 0,
        questions,
      });
    } catch (error) {
      console.error("Get quiz results error:", error);
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  });

  app.get("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getQuizStats(req.userId!);
      const attempts = await storage.getQuizAttempts(req.userId!);
      const userProgressData = await storage.getUserProgress(req.userId!);
      
      const booksData = await storage.getBooks();
      let totalTopics = 0;
      let topicsCompleted = 0;
      const topicProgressMap: Map<string, { title: string; accuracy: number; attempts: number }> = new Map();

      for (const book of booksData) {
        const chaptersData = await storage.getChaptersByBook(book.id);
        for (const chapter of chaptersData) {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          totalTopics += topicsData.length;
          
          for (const topic of topicsData) {
            if (userProgressData.some(p => p.topicId === topic.id && p.isCompleted)) {
              topicsCompleted++;
            }

            const topicAttempts = attempts.filter(a => a.topicId === topic.id);
            if (topicAttempts.length > 0) {
              const avgScore = Math.round(
                topicAttempts.reduce((sum, a) => sum + a.score, 0) / topicAttempts.length
              );
              topicProgressMap.set(topic.id, {
                title: topic.title,
                accuracy: avgScore,
                attempts: topicAttempts.length,
              });
            }
          }
        }
      }

      const topicProgress = Array.from(topicProgressMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));

      const recentAttempts = attempts.slice(0, 10).map(a => ({
        id: a.id,
        date: a.createdAt.toISOString(),
        score: a.score,
        mode: a.mode,
        topicTitle: undefined,
      }));

      res.json({
        totalAttempts: stats.totalAttempts,
        averageAccuracy: stats.averageScore,
        topicsCompleted,
        totalTopics,
        topicProgress,
        recentAttempts,
      });
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ message: "Failed to get progress" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
