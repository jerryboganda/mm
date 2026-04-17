import { test, expect } from '@playwright/test';

/**
 * API Tests for Maternal Mind Backend
 *
 * These tests exercise the server API directly using Playwright's request
 * fixture (no browser). The server runs on port 5000.
 *
 * Run with:
 *   npx playwright test tests/api.spec.ts
 */

const API_BASE_URL = 'http://localhost:5000';

/** Generate a unique email per invocation to avoid collisions across test runs. */
function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// ---------------------------------------------------------------------------
// 1. Health Check
// ---------------------------------------------------------------------------
test.describe('Health Check', () => {
  test('GET /health returns 200 with status "healthy"', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('db');
    expect(body).toHaveProperty('memory');
  });

  test('GET /ready returns 200 with status "ready"', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/ready`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ready');
  });
});

// ---------------------------------------------------------------------------
// 2. Auth Flow
// ---------------------------------------------------------------------------
test.describe('Auth Flow', () => {
  test('POST /api/auth/register with valid data returns requiresEmailVerification: true', async ({
    request,
  }) => {
    const email = uniqueEmail();

    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email,
        password: 'Secure123!',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.requiresEmailVerification).toBe(true);
    expect(body.email).toBe(email);
    expect(body).toHaveProperty('message');
  });

  test('POST /api/auth/register with duplicate email returns 400', async ({
    request,
  }) => {
    const email = uniqueEmail();

    // First registration -- should succeed
    const first = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { name: 'First User', email, password: 'Secure123!' },
    });
    expect(first.status()).toBe(200);

    // Second registration with the same email -- should fail
    const second = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { name: 'Duplicate User', email, password: 'Secure123!' },
    });

    expect(second.status()).toBe(400);

    const body = await second.json();
    expect(body.message).toMatch(/already registered/i);
  });

  test('POST /api/auth/register with invalid email returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        name: 'Bad Email User',
        email: 'not-an-email',
        password: 'Secure123!',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/auth/login with wrong credentials returns 401', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent-user@example.com',
        password: 'WrongPassword1!',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/invalid email or password/i);
  });

  test('POST /api/auth/login without email verification returns 403 with code EMAIL_NOT_VERIFIED', async ({
    request,
  }) => {
    const email = uniqueEmail();

    // Register a user (email will NOT be verified)
    const regResponse = await request.post(
      `${API_BASE_URL}/api/auth/register`,
      {
        data: { name: 'Unverified User', email, password: 'Secure123!' },
      },
    );
    expect(regResponse.status()).toBe(200);

    // Attempt login before email verification
    const loginResponse = await request.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        data: { email, password: 'Secure123!' },
      },
    );

    expect(loginResponse.status()).toBe(403);

    const body = await loginResponse.json();
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body).toHaveProperty('message');
    expect(body.email).toBe(email);
  });
});

// ---------------------------------------------------------------------------
// 3. Protected Routes
// ---------------------------------------------------------------------------
test.describe('Protected Routes - require auth token', () => {
  test('GET /api/books without auth token returns 401', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/books`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/unauthorized/i);
  });

  test('GET /api/progress without auth token returns 401', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE_URL}/api/progress`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/unauthorized/i);
  });

  test('GET /api/quiz/stats without auth token returns 401', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE_URL}/api/quiz/stats`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/unauthorized/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Rate Limiting
// ---------------------------------------------------------------------------
test.describe('Rate Limiting', () => {
  test('sending >5 register requests in 15 minutes returns 429', async ({
    request,
  }) => {
    const responses: number[] = [];

    // The register endpoint allows 5 requests per 15-minute window per IP.
    // Send 7 requests sequentially (each with a unique email) to trigger the limit.
    for (let i = 0; i < 7; i++) {
      const res = await request.post(`${API_BASE_URL}/api/auth/register`, {
        data: {
          name: `Rate Limit User ${i}`,
          email: uniqueEmail(),
          password: 'Secure123!',
        },
      });
      responses.push(res.status());
    }

    // At least one response should be 429 (rate-limited)
    const rateLimited = responses.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Input Validation
// ---------------------------------------------------------------------------
test.describe('Input Validation', () => {
  test('POST /api/auth/register with empty name returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        name: '',
        email: uniqueEmail(),
        password: 'Secure123!',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/auth/register with short password (<6 chars) returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: {
        name: 'Short Password User',
        email: uniqueEmail(),
        password: '12345', // Only 5 chars -- minimum is 6
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/content-reports without auth returns 401', async ({
    request,
  }) => {
    const response = await request.post(
      `${API_BASE_URL}/api/content-reports`,
      {
        data: {
          contentType: 'topic',
          contentId: 'some-id',
          reportType: 'typo',
          description: 'Found a typo in the content',
        },
      },
    );

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.message).toMatch(/unauthorized/i);
  });
});
