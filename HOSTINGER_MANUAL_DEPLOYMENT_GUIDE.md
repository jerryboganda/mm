# Hostinger Manual Deployment Guide

Since auto-deployment has been disabled on Hostinger, you have full control over when to publish updates.

---

## 3 Easy Ways to Trigger a Manual Deployment

### Method 1: GitHub Actions (Recommended — Single Click)

1. Open your repository on GitHub:
   `https://github.com/jerryboganda/mm/actions`
2. In the left sidebar, click **Manual Deploy to Hostinger**.
3. Click the **Run workflow** button on the right side.
4. Select the target component:
   - `all` — Deploys both the Main Website and App / Admin Panel
   - `website` — Deploys only the Main Landing Page (`maternalmind.com.pk`)
   - `app_and_admin` — Deploys only the App & Admin Panel
5. Click **Run workflow**.

---

### Method 2: Hostinger hPanel (Manual Deploy Button)

1. Log in to your **Hostinger Account** at `https://hpanel.hostinger.com`.
2. Go to your domain / hosting management section.
3. Under **Advanced** or **Files**, select **Git**.
4. Click the **Deploy** button manually whenever you are ready to publish code changes.

---

### Method 3: Command Line / Webhook Script

If you have configured your Hostinger Git Webhook URL:

1. Add your Webhook URL to your `.env` file:
   ```env
   HOSTINGER_WEBHOOK_URL=https://hpanel.hostinger.com/api/git/deploy/...
   ```
2. Run the following command in your terminal anytime:
   ```bash
   npm run deploy:hostinger
   ```
