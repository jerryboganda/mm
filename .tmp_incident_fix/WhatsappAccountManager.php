<?php

namespace App\Traits;

use App\Constants\Status;
use App\Models\WhatsappAccount;
use App\Services\MetaWebhookSyncService;
use App\Services\WhatsappTokenRefreshService;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Http;

trait WhatsappAccountManager
{
    use WhatsappManager;

    public function whatsappAccounts()
    {
        $pageTitle = "Manage WhatsApp Account";
        $user = getParentUser();
        $view = 'Template::user.whatsapp.accounts';
        $whatsappAccountsQuery = WhatsappAccount::where('user_id', $user->id)->orderBy('is_default', 'desc');

        if (isApiRequest()) {
            $whatsappAccounts = $whatsappAccountsQuery->get();
        } else {
            $whatsappAccounts = $whatsappAccountsQuery->paginate(getPaginate(10));
        }

        return responseManager("whatsapp_accounts", $pageTitle, "success", [
            'pageTitle' => $pageTitle,
            'view' => $view,
            'whatsappAccounts' => $whatsappAccounts,
            'accountLimit' => featureAccessLimitCheck($user->account_limit)
        ]);
    }

    public function storeWhatsappAccount(Request $request)
    {
        $request->validate([
            'whatsapp_number' => 'required',
            'whatsapp_business_account_id' => 'required',
            'phone_number_id' => 'required',
            'meta_access_token' => 'required',
            'meta_app_id' => 'required',
        ]);

        $user = getParentUser();

        if (!featureAccessLimitCheck($user->account_limit)) {
            $message = "You have reached the maximum limit of WhatsApp account. Please upgrade your plan.";
            return responseManager("whatsapp_error", $message, "error");
        }

        $accountExists = WhatsappAccount::where('phone_number_id', $request->phone_number_id)
            ->orWhere('whatsapp_business_account_id', $request->whatsapp_business_account_id)
            ->exists();

        if ($accountExists) {
            $message = 'This account already has been registered to our system';
            return responseManager("whatsapp_error", $message, "error");
        }

        try {
            $whatsappData = $this->verifyWhatsappCredentials($request->whatsapp_business_account_id, $request->meta_access_token);
        } catch (Exception $ex) {
            return responseManager("whatsapp_error", $ex->getMessage());
        }

        $whatsAccountData = $whatsappData['data'];

        if ($whatsAccountData['code_verification_status'] != 'VERIFIED') {
            $notify[] = ['info', 'Your whatsapp business account is not verified. Please create a permanent access token.'];
            if (isApiRequest()) {
                $notify[] = 'Your whatsapp business account is not verified. Please create a permanent access token.';
            }
        }

        // Try to exchange the provided token for a long-lived one
        $tokenToStore = $request->meta_access_token;
        $expiresAt = null;

        // Build a temporary account object with meta_app_id from request or general settings
        // (the real account hasn't been saved yet)
        $tempAccount = new WhatsappAccount();
        $tempAccount->meta_app_id = $request->meta_app_id ?? null;
        $tempAccount->meta_app_secret = $request->meta_app_secret ?? null;

        $exchangeResult = $this->longLivedToken($tokenToStore, $tempAccount);
        if (!empty($exchangeResult['access_token'])) {
            $tokenToStore = $exchangeResult['access_token'];
            if (!empty($exchangeResult['expires_in'])) {
                $expiresAt = Carbon::now()->addSeconds((int) $exchangeResult['expires_in']);
            } else {
                $expiresAt = Carbon::now()->addDays(58);
            }
            Log::info('storeWhatsappAccount: exchanged for long-lived token', [
                'expires_at' => $expiresAt?->toDateTimeString(),
            ]);
        } else {
            Log::warning('storeWhatsappAccount: long-lived token exchange failed, storing provided token', [
                'exchange_response' => $exchangeResult,
            ]);
        }

        $whatsappAccount = new WhatsappAccount();
        $whatsappAccount->user_id = $user->id;
        $whatsappAccount->phone_number_id = $whatsAccountData['id'];
        $whatsappAccount->phone_number = $request->whatsapp_number;
        $whatsappAccount->business_name = $whatsAccountData['verified_name'];
        $whatsappAccount->access_token = $tokenToStore;
        $whatsappAccount->token_expires_at = $expiresAt;
        $whatsappAccount->token_refreshed_at = Carbon::now();
        $whatsappAccount->code_verification_status = $whatsAccountData['code_verification_status'];
        $whatsappAccount->whatsapp_business_account_id = $request->whatsapp_business_account_id;
        $whatsappAccount->meta_app_id = $request->meta_app_id;
        $whatsappAccount->meta_app_secret = $request->meta_app_secret;
        $whatsappAccount->is_default = WhatsappAccount::where('user_id', $user->id)->count() ? Status::NO : Status::YES;
        $whatsappAccount->save();

        $this->syncWebhookHealth($whatsappAccount);

        decrementFeature($user, 'account_limit');

        if (isApiRequest()) {
            $notify[] = "WhatsApp account added successfully";
            return apiResponse("whatsapp_success", "success", $notify, [
                'whatsappAccount' => $whatsappAccount
            ]);
        }

        $notify[] = ["success", "WhatsApp account added successfully"];
        return to_route('user.whatsapp.account.index')->withNotify($notify);
    }

    public function whatsappAccountVerificationCheck($accountId)
    {
        $user = getParentUser();
        $whatsappAccount = WhatsappAccount::where('user_id', $user->id)->findOrFailWithApi("whatsapp account", $accountId);

        try {
            $whatsappData = $this->verifyWhatsappCredentials($whatsappAccount->whatsapp_business_account_id, $whatsappAccount->access_token);
            if ($whatsappData['data']['verified_name'] && $whatsappData['data']['display_phone_number']) {
                $whatsappAccount->business_name = $whatsappData['data']['verified_name'];
                $whatsappAccount->phone_number = $whatsappData['data']['display_phone_number'];
                $whatsappAccount->save();
            }
        } catch (Exception $ex) {
            return responseManager("whatsapp_error", $ex->getMessage());
        }

        $whatsappAccount->code_verification_status = $whatsappData['data']['code_verification_status'];
        $whatsappAccount->save();

        $message = "WhatsApp account verification status updated successfully";
        return responseManager("verification_status", $message, "success");
    }

    public function whatsappAccountConnect($id)
    {
        $user = getParentUser();
        $whatsappAccount = WhatsappAccount::where('user_id', $user->id)->findOrFailWithApi("whatsapp account", $id);
        $whatsappAccount->is_default = Status::YES;
        $whatsappAccount->save();

        WhatsappAccount::where('user_id', $user->id)->where('id', '!=', $whatsappAccount->id)->update(['is_default' => Status::NO]);

        $message = "WhatsApp account connected successfully";
        return responseManager("whatsapp_success", $message, "success");
    }

    public function whatsappAccountSettingConfirm(Request $request, $accountId)
    {
        $request->validate([
            'meta_access_token' => 'required',
        ]);

        $user = getParentUser();
        $whatsappAccount = WhatsappAccount::where('user_id', $user->id)->findOrFailWithApi("whatsapp account", $accountId);

        // Try to exchange the provided token for a long-lived one
        $tokenToStore = $request->meta_access_token;
        $expiresAt = null;

        $exchangeResult = $this->longLivedToken($tokenToStore, $whatsappAccount);
        if (!empty($exchangeResult['access_token'])) {
            $tokenToStore = $exchangeResult['access_token'];
            if (!empty($exchangeResult['expires_in'])) {
                $expiresAt = Carbon::now()->addSeconds((int) $exchangeResult['expires_in']);
            } else {
                // Long-lived tokens typically last 60 days
                $expiresAt = Carbon::now()->addDays(58);
            }
            Log::info('whatsappAccountSettingConfirm: exchanged for long-lived token', [
                'account_id' => $whatsappAccount->id,
                'expires_at' => $expiresAt?->toDateTimeString(),
            ]);
        } else {
            Log::warning('whatsappAccountSettingConfirm: long-lived token exchange failed, using provided token as-is', [
                'account_id' => $whatsappAccount->id,
                'exchange_response' => $exchangeResult,
            ]);
            // Provided token may be a System User Token (never expires) or already long-lived
            $expiresAt = null;
        }

        try {
            $whatsappData = $this->verifyWhatsappCredentials($whatsappAccount->whatsapp_business_account_id, $tokenToStore);
        } catch (Exception $ex) {
            return responseManager("whatsapp_error", $ex->getMessage());
        }

        $whatsappAccount->access_token = $tokenToStore;
        $whatsappAccount->token_expires_at = $expiresAt;
        $whatsappAccount->token_refreshed_at = Carbon::now();
        $whatsappAccount->code_verification_status = $whatsappData['data']['code_verification_status'];
        // Save meta_app_secret if provided in the form
        if ($request->filled('meta_app_secret')) {
            $whatsappAccount->meta_app_secret = $request->meta_app_secret;
        }
        $whatsappAccount->save();

        $this->syncWebhookHealth($whatsappAccount);

        $message = "WhatsApp account credentials updated successfully";
        return responseManager("whatsapp_success", $message, "success");
    }

    public function embeddedSignup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'business_id' => 'required',
            'waba_id' => 'required',
            'phone_number_id' => 'required'
        ]);

        if ($validator->fails()) {
            return apiResponse("error", "validation error", $validator->errors()->all(), [], 422);
        }

        $user = auth()->user();

        if (!featureAccessLimitCheck($user->account_limit)) {
            return apiResponse("error", "error", ["You have reached your account limit"]);
        }

        $accountExists = WhatsappAccount::where('phone_number_id', $request->phone_number_id)
            ->orWhere('whatsapp_business_account_id', $request->waba_id)
            ->exists();

        if ($accountExists) {
            $notify[] = 'This account already has been registered to our system';
            return apiResponse("whatsapp_error", "error", $notify, [
                'success' => false
            ]);
        }

        $userAccounts = WhatsappAccount::where('user_id', $user->id)->get();

        $isDefaultAccount = Status::NO;

        if ($userAccounts->count() < 1) {
            $isDefaultAccount = Status::YES;
        }

        $whatsappAccount = new WhatsappAccount();
        $whatsappAccount->user_id = $user->id;
        $whatsappAccount->whatsapp_business_account_id = $request->waba_id;
        $whatsappAccount->phone_number_id = $request->phone_number_id;
        $whatsappAccount->is_default = $isDefaultAccount;

        $whatsappAccount->save();

        decrementFeature($user, 'account_limit');

        $notify[] = 'WhatsApp account added successfully';
        return apiResponse("success", "success", $notify, [
            'success' => true
        ]);
    }

    public function accessToken(Request $request)
    {
        $whatsappAccount = WhatsappAccount::where('user_id', auth()->id())
            ->where('whatsapp_business_account_id', $request->waba_id)
            ->first();

        $url = "https://graph.facebook.com/v21.0/oauth/access_token";

        // Use per-account credentials first, fall back to general settings
        $clientId = ($whatsappAccount && $whatsappAccount->meta_app_id) ? $whatsappAccount->meta_app_id : gs('meta_app_id');
        $clientSecret = ($whatsappAccount && $whatsappAccount->meta_app_secret) ? $whatsappAccount->meta_app_secret : gs('meta_app_secret');

        $response = Http::get($url, [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'code' => $request->code,
        ]);

        $data = $response->json();

        if (empty($data['access_token'])) {
            Log::error('accessToken: OAuth code exchange failed', [
                'waba_id' => $request->waba_id,
                'response' => $data,
            ]);
            return apiResponse("error", "error", ['Failed to obtain access token from Meta']);
        }

        $permanentToken = $this->longLivedToken($data['access_token'], $whatsappAccount);
        $expiresAt = null;

        if (!empty($permanentToken['access_token'])) {
            $data['access_token'] = $permanentToken['access_token'];
            if (!empty($permanentToken['expires_in'])) {
                $expiresAt = Carbon::now()->addSeconds((int) $permanentToken['expires_in']);
            } else {
                $expiresAt = Carbon::now()->addDays(58);
            }
            Log::info('accessToken: long-lived token obtained', [
                'account_id' => $whatsappAccount->id,
                'expires_at' => $expiresAt?->toDateTimeString(),
            ]);
        } else {
            Log::warning('accessToken: long-lived token exchange FAILED - storing short-lived token', [
                'account_id' => $whatsappAccount->id,
                'exchange_response' => $permanentToken,
            ]);
            // Short-lived token expires in ~1 hour
            $expiresAt = Carbon::now()->addMinutes(55);
        }

        $whatsappAccount->access_token = $data['access_token'];
        $whatsappAccount->token_expires_at = $expiresAt;
        $whatsappAccount->token_refreshed_at = Carbon::now();

        $appData = $this->metaAppId($whatsappAccount->whatsapp_business_account_id, $data['access_token']);

        if (isset($appData['id'])) {
            $whatsappAccount->meta_app_id = $appData['id'];
        }

        $whatsappAccount->save();
        $this->syncWebhookHealth($whatsappAccount);

        $notify[] = 'Access token updated successfully';
        return apiResponse("success", "success", $notify, [
            'success' => true,
            'access_token' => $data['access_token']
        ]);
    }

    /**
     * Exchange a short-lived token for a long-lived token (~60 days).
     * Long-lived tokens can also be refreshed by passing them as the input token
     * (Meta will return a new long-lived token with a fresh 60-day expiry).
     *
     * @param  string  $shortLivedToken
     * @param  WhatsappAccount|null  $account  Optional account for per-account credentials
     * @return array  {access_token, token_type, expires_in} on success, or {error} on failure
     */
    private function longLivedToken($shortLivedToken, ?WhatsappAccount $account = null)
    {
        if (empty($shortLivedToken)) {
            Log::warning('longLivedToken: called with empty token');
            return ['access_token' => null];
        }

        // Use per-account credentials first, fall back to general settings
        $appId = ($account && $account->meta_app_id) ? $account->meta_app_id : gs('meta_app_id');
        $appSecret = ($account && $account->meta_app_secret) ? $account->meta_app_secret : gs('meta_app_secret');

        if (empty($appId) || empty($appSecret)) {
            Log::error('longLivedToken: app credentials not configured', [
                'has_account_app_id' => $account ? !empty($account->meta_app_id) : false,
                'has_account_app_secret' => $account ? !empty($account->meta_app_secret) : false,
                'has_global_app_id' => !empty(gs('meta_app_id')),
                'has_global_app_secret' => !empty(gs('meta_app_secret')),
            ]);
            return ['access_token' => null, 'error' => 'App credentials not configured'];
        }

        $url = "https://graph.facebook.com/v22.0/oauth/access_token";

        try {
            $response = Http::timeout(30)->get($url, [
                'grant_type' => 'fb_exchange_token',
                'client_id' => $appId,
                'client_secret' => $appSecret,
                'fb_exchange_token' => $shortLivedToken
            ]);

            $result = $response->json();

            if ($response->failed() || isset($result['error'])) {
                Log::error('longLivedToken: Meta API returned error', [
                    'http_status' => $response->status(),
                    'error' => $result['error'] ?? null,
                    'meta_app_id' => $appId,
                ]);
                return ['access_token' => null, 'error' => $result['error'] ?? 'Unknown error'];
            }

            if (empty($result['access_token'])) {
                Log::error('longLivedToken: No access_token in response', [
                    'response' => $result,
                ]);
                return ['access_token' => null];
            }

            Log::info('longLivedToken: successfully exchanged token', [
                'expires_in' => $result['expires_in'] ?? 'not provided',
                'token_type' => $result['token_type'] ?? 'unknown',
            ]);

            return $result;
        } catch (\Throwable $e) {
            Log::error('longLivedToken: exception during token exchange', [
                'message' => $e->getMessage(),
            ]);
            return ['access_token' => null, 'error' => $e->getMessage()];
        }
    }

    private function subscribeApp($wabaId, $accessToken)
    {
        $url = "https://graph.facebook.com/v23.0/{$wabaId}/subscribed_apps";

        $response = Http::post($url, [
            'access_token' => $accessToken
        ]);
    }

    private function metaAppId($wabaId, $accessToken)
    {
        $appUrl = "https://graph.facebook.com/v23.0/app?{$wabaId}?fields=name,id";

        $appResponse = Http::get($appUrl, [
            'access_token' => $accessToken
        ]);

        return $appResponse->json();
    }

    private function syncWebhookHealth(WhatsappAccount $account): void
    {
        try {
            app(MetaWebhookSyncService::class)->syncForAccount($account->fresh());
        } catch (\Throwable $exception) {
            Log::error('WhatsappAccountManager: webhook sync failed', [
                'account_id' => $account->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function whatsappPin(Request $request)
    {
        $whatsappAccount = WhatsappAccount::where('user_id', auth()->id())
            ->where('whatsapp_business_account_id', $request->waba_id)
            ->first();

        $url = "https://graph.facebook.com/v23.0/{$request->waba_id}/register";

        $response = Http::post($url, [
            'access_token' => $request->access_token,
            'pin' => $request->pin
        ]);

        return to_route('user.whatsapp.account.verification.check', $whatsappAccount->id);
    }

    public function whatsappAccountCommerceSettings(Request $request, $accountId)
    {
        $request->validate([
            'is_cart_enabled' => 'nullable|boolean',
            'is_catalog_visible' => 'nullable|boolean'
        ]);

        $user = getParentUser();
        $whatsappAccount = WhatsappAccount::where('user_id', $user->id)->findOrFailWithApi("whatsapp account", $accountId);
        $whatsappLib = new \App\Lib\WhatsApp\WhatsAppLib();

        try {
            $whatsappLib->updateCommerceSettings(
                $whatsappAccount,
                $request->boolean('is_cart_enabled'),
                $request->boolean('is_catalog_visible')
            );

            $whatsappAccount->is_cart_enabled = $request->boolean('is_cart_enabled');
            $whatsappAccount->is_catalog_visible = $request->boolean('is_catalog_visible');
            $whatsappAccount->save();

            $notify[] = ['success', 'Commerce settings updated successfully'];
        } catch (Exception $ex) {
            $notify[] = ['error', $ex->getMessage()];
        }

        if (isApiRequest()) {
            return apiResponse("whatsapp_commerce_settings", "success", $notify);
        }
        return back()->withNotify($notify);
    }
}
