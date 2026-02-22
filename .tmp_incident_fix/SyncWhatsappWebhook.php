<?php

namespace App\Console\Commands;

use App\Models\WhatsappAccount;
use App\Services\MetaWebhookSyncService;
use App\Services\WhatsappTokenRefreshService;
use Illuminate\Console\Command;

class SyncWhatsappWebhook extends Command
{
    private const ACCOUNT2_ID = 2;
    private const SOURCE_ACCOUNT_ID = 1;
    private const CANONICAL_META_APP_ID = '2079994696110563';

    protected $signature = 'whatsapp:webhook:sync
                            {accountId? : Optional WhatsApp account ID}
                            {--align-account-2-app : Align account #2 to canonical app ID and refresh token}';

    protected $description = 'Re-assert Meta webhook subscription health for WhatsApp accounts';

    public function handle(MetaWebhookSyncService $service): int
    {
        if ($this->option('align-account-2-app')) {
            $this->alignAccount2();
        }

        $query = WhatsappAccount::query();
        if ($accountId = $this->argument('accountId')) {
            $query->whereKey((int) $accountId);
        }

        $accounts = $query->get();
        if ($accounts->isEmpty()) {
            $this->warn('No WhatsApp accounts found for sync.');
            return self::FAILURE;
        }

        $allOk = true;
        foreach ($accounts as $account) {
            $this->line("Syncing account #{$account->id} (WABA {$account->whatsapp_business_account_id})...");
            $result = $service->syncForAccount($account->fresh());
            $ok = (bool) ($result['ok'] ?? false);
            $allOk = $allOk && $ok;

            if ($ok) {
                $this->info('  -> OK');
                continue;
            }

            $this->error('  -> FAILED');
            $this->line('  app_sync: ' . json_encode($result['app_sync'] ?? []));
            $this->line('  waba_sync: ' . json_encode($result['waba_sync'] ?? []));
        }

        return $allOk ? self::SUCCESS : self::FAILURE;
    }

    private function alignAccount2(): void
    {
        $account = WhatsappAccount::find(self::ACCOUNT2_ID);
        if (!$account) {
            $this->warn('Account #2 not found; skipping alignment.');
            return;
        }

        $source = WhatsappAccount::find(self::SOURCE_ACCOUNT_ID);
        $changed = false;

        if ((string) $account->meta_app_id !== self::CANONICAL_META_APP_ID) {
            $account->meta_app_id = self::CANONICAL_META_APP_ID;
            $changed = true;
            $this->line('Aligned account #2 meta_app_id to canonical app.');
        }

        if (!$account->meta_app_secret && $source && $source->meta_app_secret) {
            $account->meta_app_secret = $source->meta_app_secret;
            $changed = true;
            $this->line('Copied meta_app_secret from account #1 to account #2.');
        }

        if ($changed) {
            $account->save();
        }

        $this->line('Refreshing account #2 long-lived token after alignment...');
        $refreshed = WhatsappTokenRefreshService::refreshTokenForAccount($account->fresh());
        if ($refreshed) {
            $this->info('Account #2 token refresh succeeded.');
        } else {
            $this->warn('Account #2 token refresh failed; existing token left unchanged.');
        }
    }
}
