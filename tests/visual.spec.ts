import { test, expect } from '@playwright/test';

test.describe('Maternal Mind UI Verification', () => {
    test('should display Welcome screen correctly', async ({ page }) => {
        // Go to the app root
        await page.goto('http://localhost:8081');

        // Wait for main content
        await page.waitForSelector('text=Maternal Mind');

        // Take screenshot of Welcome Screen
        await page.screenshot({ path: 'screenshots/welcome-screen.png' });

        // Check for "Get Started" button
        const getStartedBtn = page.getByTestId('button-get-started');
        await expect(getStartedBtn).toBeVisible();
    });

    test('should navigate to Login and verify layout', async ({ page }) => {
        await page.goto('http://localhost:8081');

        // Navigate to Login
        await page.getByTestId('button-have-account').click();

        // Verify Login Screen
        await expect(page.getByText('Welcome Back')).toBeVisible();
        await page.screenshot({ path: 'screenshots/login-screen.png' });
    });

    test('should navigate to Register screen', async ({ page }) => {
        await page.goto('http://localhost:8081');

        // Navigate to Onboarding then Register (or direct link)
        // Actually, "Get Started" goes to Onboarding.
        // "I already have an account" -> Login -> "Sign Up" -> Register?
        // Let's go via Login -> Don't have an account
        await page.getByTestId('button-have-account').click();

        // Look for "Don't have an account? Sign Up" button/link
        // It might be a text link.
        await page.getByText('Sign Up').click();

        // Verify Register Screen
        await expect(page.getByText('Create Account')).toBeVisible();
        await page.screenshot({ path: 'screenshots/register-screen.png' });
    });

    // Note: We cannot easily test the Stats Grid (BUG-001) or Quiz (BUG-002)
    // without a valid auth token or mocking the auth flow.
    // For now, these screenshots verify the app is running and basic UI is intact.
});
