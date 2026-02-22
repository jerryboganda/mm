<?php

namespace App\Services;

use App\Models\WhatsappAccount;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetaWebhookSyncService
{
    private const GRAPH_VERSION = 'v23.0';
    private const WHATSAPP_OBJECT = 'whatsapp_business_account';

    public function syncForAccount(WhatsappAccount $account): array
    {
        $appId = $account->meta_app_id ?: gs('meta_app_id');
        $appSecret = $account->meta_app_secret ?: gs('meta_app_secret');

        if (!$appId || !$appSecret) {
            $result = [
                'ok' => false,
                'reason' => 'missing_app_credentials',
                'account_id' => $account->id,
                'app_id' => $appId,
            ];

            Log::warning('MetaWebhookSyncService: missing app credentials', $result);
            return $result;
        }

        $appSync = $this->ensureAppWebhookSubscription($appId, $appSecret);
        $wabaSync = $this->ensureWabaAppSubscription($account->whatsapp_business_account_id, $account->access_token);

        $result = [
            'ok' => ($appSync['ok'] ?? false) && ($wabaSync['ok'] ?? false),
            'account_id' => $account->id,
            'waba_id' => $account->whatsapp_business_account_id,
            'app_id' => $appId,
            'app_sync' => $appSync,
            'waba_sync' => $wabaSync,
        ];

        Log::info('MetaWebhookSyncService: sync result', $result);
        return $result;
    }

    public function ensureAppWebhookSubscription(string $appId, string $appSecret): array
    {
        $callbackUrl = $this->callbackUrl();
        $verifyToken = (string) (gs('webhook_verify_token') ?? '');
        $fields = 'messages,message_template_status_update';
        $appAccessToken = $appId . '|' . $appSecret;
        $url = $this->graphUrl($appId . '/subscriptions');

        $current = Http::timeout(30)->get($url, [
            'access_token' => $appAccessToken,
        ]);
        $currentPayload = $current->json();

        $isAlreadyConfigured = collect($currentPayload['data'] ?? [])->contains(function ($subscription) use ($callbackUrl) {
            $subscriptionCallback = (string) ($subscription['callback_url'] ?? '');
            $callbackMatches = $subscriptionCallback === ''
                || rtrim($subscriptionCallback, '/') === rtrim($callbackUrl, '/');

            return ($subscription['object'] ?? null) === self::WHATSAPP_OBJECT
                && $callbackMatches
                && (bool) ($subscription['active'] ?? false);
        });

        $postPayload = null;
        if (!$isAlreadyConfigured) {
            $postPayload = Http::timeout(30)->post($url, [
                'access_token' => $appAccessToken,
                'object' => self::WHATSAPP_OBJECT,
                'callback_url' => $callbackUrl,
                'verify_token' => $verifyToken,
                'fields' => $fields,
                'include_values' => true,
            ]);
        }

        $verify = Http::timeout(30)->get($url, [
            'access_token' => $appAccessToken,
        ]);
        $verifyPayload = $verify->json();
        $isConfigured = collect($verifyPayload['data'] ?? [])->contains(function ($subscription) use ($callbackUrl) {
            $subscriptionCallback = (string) ($subscription['callback_url'] ?? '');
            $callbackMatches = $subscriptionCallback === ''
                || rtrim($subscriptionCallback, '/') === rtrim($callbackUrl, '/');

            return ($subscription['object'] ?? null) === self::WHATSAPP_OBJECT
                && $callbackMatches
                && (bool) ($subscription['active'] ?? false);
        });

        return [
            'ok' => $isConfigured,
            'already_configured' => $isAlreadyConfigured,
            'callback_url' => $callbackUrl,
            'verify_token_set' => $verifyToken !== '',
            'fields' => $fields,
            'current_http' => $current->status(),
            'post_http' => $postPayload ? $postPayload->status() : null,
            'verify_http' => $verify->status(),
            'post_error' => $postPayload ? ($postPayload->json()['error'] ?? null) : null,
            'verify_error' => $verifyPayload['error'] ?? null,
        ];
    }

    public function ensureWabaAppSubscription(string $wabaId, string $accessToken): array
    {
        if (!$wabaId || !$accessToken) {
            return [
                'ok' => false,
                'reason' => 'missing_waba_or_token',
            ];
        }

        $url = $this->graphUrl($wabaId . '/subscribed_apps');
        $current = Http::timeout(30)->get($url, [
            'access_token' => $accessToken,
        ]);
        $currentPayload = $current->json();
        $isAlreadySubscribed = !empty($currentPayload['data'] ?? []);

        $postPayload = null;
        if (!$isAlreadySubscribed) {
            $postPayload = Http::timeout(30)->post($url, [
                'access_token' => $accessToken,
            ]);
        }

        $verify = Http::timeout(30)->get($url, [
            'access_token' => $accessToken,
        ]);
        $verifyPayload = $verify->json();
        $isSubscribed = !empty($verifyPayload['data'] ?? []);

        return [
            'ok' => $isSubscribed,
            'already_subscribed' => $isAlreadySubscribed,
            'current_http' => $current->status(),
            'post_http' => $postPayload ? $postPayload->status() : null,
            'verify_http' => $verify->status(),
            'post_error' => $postPayload ? ($postPayload->json()['error'] ?? null) : null,
            'verify_error' => $verifyPayload['error'] ?? null,
        ];
    }

    private function callbackUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/webhook';
    }

    private function graphUrl(string $path): string
    {
        return 'https://graph.facebook.com/' . self::GRAPH_VERSION . '/' . ltrim($path, '/');
    }
}
