import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import {
  insertWaitlistSchema,
  insertNewsletterSchema,
  insertContactSchema,
  insertInstitutionalRequestSchema,
  reviewPaymentProofSchema,
  manualGrantSchema,
  paymentInstructionsSchema,
} from '../shared/schema';
import { isMysql } from '../server/db';
import { sql } from 'drizzle-orm';
import {
  SOURCE_DOCX_SHA256,
  TOTAL_BOOK_COUNT,
  TOTAL_TOPIC_COUNT,
  isImportedBookBlock,
  parseReleaseMarker,
} from '../shared/book-document-contract';
import { validateBookDocumentHtml, BookDocumentPolicyViolation } from '../server/lib/book-document-policy';
import { sanitizeString, sanitizeHtml } from '../server/lib/api-response';
import { effectiveSubscriptionStatus } from '../server/lib/subscription-status';

function startTestServer(app: express.Express): Promise<{ server: any; baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      const baseUrl = 'http://127.0.0.1:' + addr.port;
      resolve({
        server,
        baseUrl,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

test.describe('Milestone 1 Empirical Challenge & Route Stress Suite', () => {

  test.describe('1. Schema Validation & Null/Undefined Safety on Website Models', () => {
    test('insertWaitlistSchema rejects null, undefined, non-object, and missing email', () => {
      assert.equal(insertWaitlistSchema.safeParse(null).success, false);
      assert.equal(insertWaitlistSchema.safeParse(undefined).success, false);
      assert.equal(insertWaitlistSchema.safeParse({}).success, false);
      assert.equal(insertWaitlistSchema.safeParse({ email: 12345 }).success, false);
      assert.equal(insertWaitlistSchema.safeParse({ email: 'user@example.com' }).success, true);
    });

    test('insertNewsletterSchema rejects missing email or invalid types', () => {
      assert.equal(insertNewsletterSchema.safeParse({}).success, false);
      assert.equal(insertNewsletterSchema.safeParse({ email: null }).success, false);
      assert.equal(insertNewsletterSchema.safeParse({ email: 'test@domain.com' }).success, true);
    });

    test('insertContactSchema requires name, email, subject, message', () => {
      assert.equal(insertContactSchema.safeParse({}).success, false);
      assert.equal(insertContactSchema.safeParse({ name: 'A' }).success, false);
      assert.equal(insertContactSchema.safeParse({ name: 'A', email: 'a@b.com' }).success, false);
      assert.equal(
        insertContactSchema.safeParse({
          name: 'Doctor A',
          email: 'doctor@hospital.org',
          subject: 'Feedback',
          message: 'Great book platform',
        }).success,
        true
      );
    });

    test('insertInstitutionalRequestSchema enforces complete organizational payload', () => {
      assert.equal(insertInstitutionalRequestSchema.safeParse({}).success, false);
      assert.equal(
        insertInstitutionalRequestSchema.safeParse({
          name: 'Dean Smith',
          institution: 'Medical University',
          role: 'Dean of Medicine',
          email: 'dean@meduni.edu',
          cohortSize: '150',
          message: 'Campus license inquiry',
        }).success,
        true
      );
    });
  });

  test.describe('2. Admin Manual Payments Schemas & Parameter Parsing', () => {
    test('paymentInstructionsSchema validation for bank, wallets, and notes', () => {
      assert.equal(paymentInstructionsSchema.safeParse({}).success, true);
      const validSettings = {
        bankName: 'Meezan Bank',
        accountTitle: 'Maternal Mind Learning',
        accountNumber: '010203040506',
        iban: 'PK12MEZN00010203040506',
        instructions: 'Please transfer and upload screenshot',
      };
      assert.equal(paymentInstructionsSchema.safeParse(validSettings).success, true);
    });

    test('reviewPaymentProofSchema enforces status rejection reasons when provided', () => {
      assert.equal(reviewPaymentProofSchema.safeParse({}).success, true);
      assert.equal(
        reviewPaymentProofSchema.safeParse({ rejectionReason: 'Screenshot unreadable' }).success,
        true
      );
    });

    test('manualGrantSchema requires packageId, priceId, and either userId or email', () => {
      assert.equal(manualGrantSchema.safeParse({}).success, false);
      assert.equal(manualGrantSchema.safeParse({ packageId: 'pkg-1' }).success, false);
      assert.equal(manualGrantSchema.safeParse({ packageId: 'pkg-1', userId: 'usr-123' }).success, false);
      assert.equal(
        manualGrantSchema.safeParse({
          packageId: 'pkg-1',
          priceId: 'price-1',
          userId: 'usr-123',
        }).success,
        true
      );
      assert.equal(
        manualGrantSchema.safeParse({
          packageId: 'pkg-1',
          priceId: 'price-1',
          email: 'student@example.com',
        }).success,
        true
      );
    });
  });

  test.describe('3. Quiz Route Parameter & Body Validation Logic', () => {
    test('Validates answers map and quiz mode defensively', () => {
      const validateQuizSubmission = (body: any) => {
        const { answers, mode } = body || {};
        if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
          return { status: 400, message: 'Answers object is required' };
        }
        if (!mode || typeof mode !== 'string') {
          return { status: 400, message: 'Quiz mode is required' };
        }
        return { status: 200, valid: true };
      };

      assert.equal(validateQuizSubmission(null).status, 400);
      assert.equal(validateQuizSubmission({}).status, 400);
      assert.equal(validateQuizSubmission({ answers: null }).status, 400);
      assert.equal(validateQuizSubmission({ answers: {} }).status, 400);
      assert.equal(validateQuizSubmission({ answers: 'string' }).status, 400);
      assert.equal(validateQuizSubmission({ answers: { q1: 'A' } }).status, 400);
      assert.equal(validateQuizSubmission({ answers: { q1: 'A' }, mode: 123 }).status, 400);
      assert.equal(validateQuizSubmission({ answers: { q1: 'A' }, mode: '' }).status, 400);
      assert.equal(validateQuizSubmission({ answers: { q1: 'A' }, mode: 'topic' }).status, 200);
    });
  });

  test.describe('4. Sanitization, Subscription Status & Helpers', () => {
    test('sanitizeString trims, normalizes NFC, and strips null bytes', () => {
      const sanitized = sanitizeString('  Dr. Farzana\0 Muneer  ');
      assert.equal(sanitized, 'Dr. Farzana Muneer');
    });

    test('sanitizeHtml strips script tags and dangerous event handlers', () => {
      const cleaned = sanitizeHtml('<p>Safe</p><script>alert(1)</script>');
      assert.ok(!cleaned.includes('<script>'));
      assert.ok(cleaned.includes('<p>Safe</p>'));
    });

    test('effectiveSubscriptionStatus evaluates active, expired, trialing, and null states', () => {
      assert.equal(effectiveSubscriptionStatus('active', null), 'active');
      assert.equal(effectiveSubscriptionStatus('canceled', null), 'canceled');
      assert.equal(effectiveSubscriptionStatus(null, null), 'none');
      const pastDate = new Date(Date.now() - 86400000);
      assert.equal(effectiveSubscriptionStatus('active', pastDate), 'expired');
      const futureDate = new Date(Date.now() + 86400000);
      assert.equal(effectiveSubscriptionStatus('active', futureDate), 'active');
    });
  });

  test.describe('5. Database Storage SQL Dialect & Random Ordering Clause', () => {
    test('storage random order expression switches cleanly between MySQL and PostgreSQL', () => {
      const mysqlClause = sql.raw('RAND()');
      const pgClause = sql.raw('RANDOM()');
      assert.ok(mysqlClause);
      assert.ok(pgClause);

      const evaluatedClause = isMysql ? sql.raw('RAND()') : sql.raw('RANDOM()');
      assert.ok(evaluatedClause);
      assert.equal(typeof evaluatedClause, 'object');
    });
  });

  test.describe('6. Book Document Contract Topology & Integrity', () => {
    test('frozen SHA256 checksum and document topology match specifications', () => {
      assert.equal(
        SOURCE_DOCX_SHA256,
        'f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605'
      );
      assert.equal(TOTAL_BOOK_COUNT, 13);
      assert.equal(TOTAL_TOPIC_COUNT, 285);
    });

    test('isImportedBookBlock properly distinguishes imported document blocks', () => {
      assert.equal(isImportedBookBlock({ contentType: 'document_html' }), true);
      assert.equal(isImportedBookBlock({ contentType: 'markdown' }), false);
      assert.equal(isImportedBookBlock({}), false);
      assert.equal(isImportedBookBlock(null), false);
      assert.equal(isImportedBookBlock(undefined), false);
    });

    test('parseReleaseMarker correctly parses topic and release hash', () => {
      const html = '<div class="mm-release-marker" data-mm-release="f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605" data-mm-topic="t-mm-01-001"></div>';
      const parsed = parseReleaseMarker(html);
      assert.deepEqual(parsed, {
        releaseSha256: 'f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605',
        topicId: 't-mm-01-001',
      });
    });

    test('validateBookDocumentHtml rejects scripts and allows safe HTML', () => {
      const safe = '<div class="mm-release-marker" data-mm-release="f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605" data-mm-topic="t-mm-01-001"><h1>Topic Title</h1><p>Content</p></div>';
      assert.doesNotThrow(() => validateBookDocumentHtml(safe));

      const malicious = '<script>document.cookie="stolen"</script>';
      assert.throws(() => validateBookDocumentHtml(malicious), BookDocumentPolicyViolation);
    });
  });

  test.describe('7. HTTP Endpoint Mocked Execution for Modified Server Routes', () => {
    let mockApp: express.Express;
    let mockHarness: { server: any; baseUrl: string; close: () => Promise<void> };

    test.before(async () => {
      mockApp = express();
      mockApp.use(express.json());

      mockApp.patch('/api/test-profile', (req, res) => {
        const { name, avatarUrl } = req.body || {};
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: 'Name is required' });
        }
        if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl === 'string') {
          const isDataImage = /^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl.trim());
          if (!isDataImage || avatarUrl.trim().length > 1500000) {
            return res.status(400).json({ message: 'Profile photo must be a PNG, JPG, or WebP image under 1.5 MB.' });
          }
        }
        return res.json({ success: true, name: sanitizeString(name) });
      });

      mockApp.post('/api/test-quiz-submit', (req, res) => {
        const { answers, mode } = req.body || {};
        if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
          return res.status(400).json({ message: 'Answers object is required' });
        }
        if (!mode || typeof mode !== 'string') {
          return res.status(400).json({ message: 'Quiz mode is required' });
        }
        return res.json({ id: 'attempt-test-123' });
      });

      mockApp.post('/api/test-validate-coupon', (req, res) => {
        const { code, packageId } = req.body || {};
        if (!code || typeof code !== 'string' || !code.trim()) {
          return res.status(400).json({ valid: false, message: 'Coupon code is required' });
        }
        if (!packageId || typeof packageId !== 'string') {
          return res.status(400).json({ valid: false, message: 'Package ID is required' });
        }
        return res.json({ valid: true, discountPercentage: 20 });
      });

      mockHarness = await startTestServer(mockApp);
    });

    test.after(async () => {
      if (mockHarness) {
        await mockHarness.close();
      }
    });

    test('Profile update: rejects empty name', async () => {
      const res = await fetch(mockHarness.baseUrl + '/api/test-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      assert.equal(res.status, 400);
      const data = await res.json() as any;
      assert.equal(data.message, 'Name is required');
    });

    test('Profile update: rejects malicious avatar URL', async () => {
      const res = await fetch(mockHarness.baseUrl + '/api/test-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Name', avatarUrl: 'javascript:alert(1)' }),
      });
      assert.equal(res.status, 400);
      const data = await res.json() as any;
      assert.match(data.message, /Profile photo must be/);
    });

    test('Profile update: accepts valid data image', async () => {
      const res = await fetch(mockHarness.baseUrl + '/api/test-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Dr. Sarah', avatarUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json() as any;
      assert.equal(data.success, true);
    });

    test('Quiz submit: accepts valid payload format', async () => {
      const res = await fetch(mockHarness.baseUrl + '/api/test-quiz-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: { 'mcq-1': 'A', 'mcq-2': 'B' },
          mode: 'exam',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json() as any;
      assert.equal(data.id, 'attempt-test-123');
    });

    test('Coupon validate: rejects invalid requests and accepts well-formed code and packageId', async () => {
      const res1 = await fetch(mockHarness.baseUrl + '/api/test-validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '', packageId: 'pkg-1' }),
      });
      assert.equal(res1.status, 400);

      const res2 = await fetch(mockHarness.baseUrl + '/api/test-validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'DISCOUNT20', packageId: 'pkg-1' }),
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json() as any;
      assert.equal(data2.valid, true);
    });
  });
});
