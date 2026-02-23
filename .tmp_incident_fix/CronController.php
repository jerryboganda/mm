<?php

namespace App\Http\Controllers;

use App\Constants\Status;
use App\Http\Controllers\User\PurchasePlanController;
use App\Lib\CurlRequest;
use App\Models\Campaign;
use App\Models\CampaignContact;
use App\Models\CampaignMessageEvent;
use App\Models\Conversation;
use App\Models\Coupon;
use App\Models\CronJob;
use App\Models\CronJobLog;
use App\Models\FlowNodeMedia;
use App\Models\GroupExtractionJob;
use App\Models\Message;
use App\Models\PlanPurchase;
use App\Models\WhatsappAccount;
use App\Lib\WhatsApp\WhatsAppLib;
use App\Services\CampaignLifecycleService;
use App\Services\GroupExtraction\GroupExtractionProcessorService;
use App\Services\MetaWebhookSyncService;
use App\Services\WhatsappTokenRefreshService;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CronController extends Controller
{
    public function cron()
    {
        $general = gs();
        $general->last_cron = now();
        $general->save();

        $crons = CronJob::with('schedule');

        if (request()->alias) {
            $crons->where('alias', request()->alias);
        } else {
            $crons->where('next_run', '<', now())->where('is_running', Status::YES);
        }
        $crons = $crons->get();
        foreach ($crons as $cron) {
            $cronLog = new CronJobLog();
            $cronLog->cron_job_id = $cron->id;
            $cronLog->start_at = now();

            if ($cron->is_default) {
                $controller = new $cron->action[0];
                try {
                    $method = $cron->action[1];
                    $controller->$method();
                } catch (\Exception $e) {
                    $cronLog->error = $e->getMessage();
                }
            } else {
                try {
                    CurlRequest::curlContent($cron->url);
                } catch (\Exception $e) {
                    $cronLog->error = $e->getMessage();
                }
            }
            $cron->last_run = now();
            $cron->next_run = now()->addSeconds((int) $cron->schedule->interval);
            $cron->save();

            $cronLog->end_at = $cron->last_run;

            $startTime = Carbon::parse($cronLog->start_at);
            $endTime = Carbon::parse($cronLog->end_at);
            $diffInSeconds = $startTime->diffInSeconds($endTime);
            $cronLog->duration = $diffInSeconds;
            $cronLog->save();
        }
        if (request()->target == 'all') {
            $notify[] = ['success', 'Cron executed successfully'];
            return back()->withNotify($notify);
        }
        if (request()->alias) {
            $notify[] = ['success', keyToTitle(request()->alias) . ' executed successfully'];
            return back()->withNotify($notify);
        }
    }

    public function subscriptionExpired()
    {
        $expiredSubscriptions = PlanPurchase::with(['user', 'plan'])->where('expired_at', '<=', Carbon::now())->where('is_sent_expired_notify', Status::NO)->get();

        foreach ($expiredSubscriptions as $subscription) {

            $user = $subscription->user;
            $plan = $subscription->plan;



            if (!$user || !$plan)
                continue;

            $subscription->is_sent_expired_notify = Status::YES;
            $subscription->save();

            if ($subscription->auto_renewal) {
                $purchasePrice = getPlanPurchasePrice($plan, $subscription->recurring_type);
                if ($purchasePrice <= 0)
                    continue;

                if ($user->balance < $purchasePrice) {
                    notify($user, 'SUBSCRIPTION_EXPIRED', [
                        'subscription_type' => $subscription->billing_cycle,
                        'subscription_url' => route('user.subscription.index'),
                        'plan_name' => $plan->name,
                        'amount' => showAmount($purchasePrice, currencyFormat: false),
                        'expired_at' => showDateTime($subscription->expired_at),
                        'post_balance' => showAmount($user->balance, currencyFormat: false),
                    ]);
                } else {
                    PurchasePlanController::updateUserSubscription($user, $plan, $subscription->recurring_type);
                }
                continue;
            }

            $user->account_limit = 0;
            $user->agent_limit = 0;
            $user->contact_limit = 0;
            $user->template_limit = 0;
            $user->flow_limit = 0;
            $user->campaign_limit = 0;
            $user->short_link_limit = 0;
            $user->floater_limit = 0;
            $user->welcome_message = 0;
            $user->ai_assistance = 0;
            $user->interactive_message = 0;
            $user->save();

            notify($user, 'SUBSCRIPTION_EXPIRED', [
                'subscription_type' => $subscription->billing_cycle,
                'subscription_url' => route('user.subscription.index'),
                'plan_name' => $plan->name,
                'amount' => showAmount($subscription->amount, currencyFormat: false),
                'expired_at' => showDateTime($subscription->expired_at),
                'post_balance' => showAmount($user->balance, currencyFormat: false),
            ]);
        }
    }

    public function subscriptionNotify()
    {
        $targetDate = Carbon::now()->addDays(gs('subscription_notify_before'))->startOfDay()->format('Y-m-d');
        $subscriptions = PlanPurchase::with(['user', 'plan'])
            ->whereDate('expired_at', $targetDate)
            ->where('is_sent_reminder_notify', Status::NO)
            ->get();

        foreach ($subscriptions as $subscription) {
            $user = $subscription->user;
            $purchasePrice = getPlanPurchasePrice($subscription->plan, $subscription->recurring_type);

            notify($user, 'UPCOMING_EXPIRED_SUBSCRIPTION', [
                'subscription_type' => $subscription->billing_cycle,
                'subscription_url' => route('user.subscription.index', ['tab' => 'current-plan']),
                'plan_name' => $subscription->plan->name,
                'plan_price' => showAmount($purchasePrice, currencyFormat: false),
                'next_billing' => showDateTime($subscription->expired_at, 'd M Y'),
                'post_balance' => showAmount($user->balance, currencyFormat: false),
            ]);
        }
    }

    /**
     * Cron job: Refresh expiring WhatsApp access tokens.
     * Should run daily. Refreshes tokens expiring within 7 days,
     * and also checks legacy tokens with no tracked expiry.
     */
    public function refreshWhatsappTokens()
    {
        Log::info('CronController: refreshWhatsappTokens started');

        $accounts = WhatsappAccount::whereNotNull('access_token')
            ->where('access_token', '!=', '')
            ->where(function ($q) {
                // Tokens expiring within 7 days
                $q->where('token_expires_at', '<=', Carbon::now()->addDays(7))
                    // Legacy tokens with no expiry tracked
                    ->orWhere(function ($sub) {
                        $sub->whereNull('token_expires_at')
                            ->where(function ($inner) {
                                $inner->whereNull('token_refreshed_at')
                                    ->orWhere('token_refreshed_at', '<=', Carbon::now()->subDays(30));
                            });
                    })
                    // Safety net: tokens not refreshed in 45 days
                    ->orWhere(function ($sub) {
                        $sub->whereNotNull('token_expires_at')
                            ->where(function ($inner) {
                                $inner->whereNull('token_refreshed_at')
                                    ->orWhere('token_refreshed_at', '<=', Carbon::now()->subDays(45));
                            });
                    });
            })
            ->get();

        if ($accounts->isEmpty()) {
            Log::info('CronController: refreshWhatsappTokens - no tokens need refreshing');
            return;
        }

        $success = 0;
        $failed = 0;

        foreach ($accounts as $account) {
            $result = WhatsappTokenRefreshService::refreshTokenForAccount($account);
            if ($result) {
                $success++;
            } else {
                $failed++;
                // Mark as expired if token is past its expiry
                if ($account->token_expires_at && Carbon::parse($account->token_expires_at)->isPast()) {
                    $account->code_verification_status = 'EXPIRED';
                    $account->save();
                }
            }
        }

        $syncAccounts = WhatsappAccount::whereNotNull('access_token')
            ->where('access_token', '!=', '')
            ->get();

        foreach ($syncAccounts as $account) {
            try {
                app(MetaWebhookSyncService::class)->syncForAccount($account);
            } catch (\Throwable $exception) {
                Log::error('CronController: refreshWhatsappTokens webhook sync failed', [
                    'account_id' => $account->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        Log::info('CronController: refreshWhatsappTokens completed', [
            'success' => $success,
            'failed' => $failed,
            'total' => $accounts->count(),
            'webhook_sync_accounts' => $syncAccounts->count(),
        ]);
    }

    public function campaignMessage()
    {

        $contactsQuery = CampaignContact::whereHas('campaign')
            ->whereHas('contact')
            ->where('status', Status::CAMPAIGN_MESSAGE_NOT_SENT)
            ->where('send_at', '<=', Carbon::now())
            ->with('contact', 'campaign', 'campaign.whatsappAccount')
            ->orderBy('send_at');

        if (!$contactsQuery->exists()) {
            return;
        }

        $contactsQuery->chunkById(200, function ($contacts) {
            Log::info('campaignMessage batch', ['count' => $contacts->count()]);
            $whatsAppLib = new WhatsAppLib();
            foreach ($contacts as $contact) {

                $campaign = $contact->campaign;
                $connectedWhatsapp = $campaign->whatsappAccount;
                $attemptedAt = now();

                // Atomic claim prevents duplicate processing across overlapping cron runs.
                $claimed = CampaignContact::where('id', $contact->id)
                    ->where('status', Status::CAMPAIGN_MESSAGE_NOT_SENT)
                    ->update([
                        'status' => Status::CAMPAIGN_MESSAGE_IS_SENT,
                        'delivery_status' => Status::CAMPAIGN_DELIVERY_PENDING,
                        'updated_at' => now(),
                    ]);

                if (!$claimed) {
                    continue;
                }

                if (!$connectedWhatsapp) {
                    Log::warning('campaignMessage missing whatsapp account', ['contact_id' => $contact->id]);
                    $this->markCampaignContactFailed($campaign, $contact, 'missing_whatsapp_account', [
                        'reason' => 'Missing whatsapp account',
                    ], true);
                    continue;
                }

                if ($connectedWhatsapp->code_verification_status !== 'VERIFIED') {
                    Log::warning('campaignMessage account not verified', [
                        'contact_id' => $contact->id,
                        'campaign_id' => $campaign->id,
                        'verification_status' => $connectedWhatsapp->code_verification_status,
                    ]);
                    $this->markCampaignContactFailed($campaign, $contact, 'account_not_verified', [
                        'verification_status' => $connectedWhatsapp->code_verification_status,
                    ], true);
                    continue;
                }

                $accessToken = $connectedWhatsapp->access_token;
                $phoneNumberId = $connectedWhatsapp->phone_number_id;

                if (!$accessToken || !$phoneNumberId) {
                    Log::warning('campaignMessage missing token/phone', ['contact_id' => $contact->id]);
                    $this->markCampaignContactFailed($campaign, $contact, 'missing_token_or_phone_id', [
                        'has_access_token' => !empty($accessToken),
                        'has_phone_number_id' => !empty($phoneNumberId),
                    ], true);
                    continue;
                }
                $template = $campaign->template;

                $url = "https://graph.facebook.com/v22.0/{$phoneNumberId}/messages?access_token={$accessToken}";

                $contactOriginal = $contact->contact;

                $templateHeaderParams = $campaign->template_header_params ?? [];
                $templateBodyParams = $campaign->template_body_params ?? [];

                $headerParams = parseTemplateParams($templateHeaderParams, $contactOriginal);
                $bodyParams = parseTemplateParams($templateBodyParams, $contactOriginal);

                // Click Tracking Injection
                if (!empty($bodyParams)) {
                    foreach ($bodyParams as $key => $param) {
                        if (isset($param['type']) && $param['type'] == 'text') {
                            $text = $param['text'];
                            // Check if text is a URL
                            if (filter_var($text, FILTER_VALIDATE_URL)) {
                                $trackingUrl = route('campaign.click', [
                                    'c' => $campaign->id,
                                    'u' => $contactOriginal->id,
                                    'url' => $text
                                ]);
                                $bodyParams[$key]['text'] = $trackingUrl;
                            }
                        }
                    }
                }

                $conversation = Conversation::where('user_id', $campaign->user_id)->where('contact_id', $contactOriginal->id)->first();

                if (!$conversation) {
                    $conversation = new Conversation();
                    $conversation->user_id = $campaign->user_id;
                    $conversation->whatsapp_account_id = $connectedWhatsapp->id;
                    $conversation->contact_id = $contactOriginal->id;
                    $conversation->save();
                }

                $components = [];

                if (count($template->cards) == 0) {
                    if (is_array($headerParams) && count($headerParams)) {
                        $components[] = [
                            'type' => 'header',
                            'parameters' => $headerParams
                        ];
                    } elseif ($template->header_format === 'IMAGE' && !empty($template->header_media)) {
                        $headerComponent = $whatsAppLib->buildTemplateImageHeaderComponent($template, $connectedWhatsapp);
                        if (!$headerComponent) {
                            $this->markCampaignContactFailed($campaign, $contact, 'template_header_media_unavailable', [
                                'template_id' => (int) ($template->id ?? 0),
                                'template_media' => (string) $template->header_media,
                            ], true);
                            continue;
                        }
                        $components[] = $headerComponent;
                    }
                }

                if (is_array($bodyParams) && count($bodyParams)) {
                    $components[] = [
                        'type' => 'body',
                        'parameters' => $bodyParams
                    ];
                } else {
                    $components[] = [
                        'type' => 'body',
                        'parameters' => []
                    ];
                }

                if (empty($components)) {
                    continue;
                }

                if (!empty($template->cards) && count($template->cards) > 0) {
                    $cards = [];

                    foreach ($template->cards as $index => $card) {
                        $cardData = [];
                        $cardData['card_index'] = $index;
                        $cardData['components'] = [];
                        $cardData['components'] = [];
                        if ($card->header_format == 'IMAGE') {
                            $cardData['components'][] = [
                                'type' => 'header',
                                'parameters' => [
                                    [
                                        'type' => 'image',
                                        'image' => [
                                            'id' => $card->media_id
                                        ]
                                    ]
                                ]
                            ];
                        } elseif ($card->header_format == 'VIDEO') {
                            $cardData['components'][] = [
                                'type' => 'header',
                                'parameters' => [
                                    [
                                        'type' => 'video',
                                        'video' => [
                                            'id' => $card->media_id
                                        ]
                                    ]
                                ]
                            ];
                        }

                        if ($card->buttons && count($card->buttons) > 0) {
                            $cardButtons = [];
                            foreach ($card->buttons['buttons'] as $button) {
                                if ($button['type'] == 'URL') {
                                    $cardButtons[] = [
                                        'type' => 'button',
                                        'sub_type' => strtolower($button['type']),
                                        'index' => $index
                                    ];
                                }
                            }
                            $cardData['components'] = array_merge($cardData['components'], $cardButtons);
                        }

                        $cards[] = $cardData;
                    }

                    $secondParams = [
                        'type' => 'carousel',
                        'cards' => $cards
                    ];

                    $components[] = $secondParams;
                }

                $data = [
                    'messaging_product' => 'whatsapp',
                    'to' => '+' . $contactOriginal->mobileNumber,
                    'type' => 'template',
                    'template' => [
                        'name' => trim($template->name),
                        'language' => [
                            'code' => $template->language->code,
                        ],
                        'components' => $components
                    ],
                ];

                $response = Http::withHeaders([
                    'Authorization' => "Bearer {$accessToken}",
                ])->post($url, $data);

                $responseData = $response->json();

                // Auto-retry on token expiry (HTTP 401 or Meta error code 190)
                $errorCode = $responseData['error']['code'] ?? null;
                $errorSubcode = $responseData['error']['error_subcode'] ?? null;
                $isTokenExpired = $response->status() === 401
                    || $errorCode == 190
                    || $errorSubcode == 463
                    || $errorSubcode == 467;

                if ($isTokenExpired) {
                    Log::warning('campaignMessage: token expired, attempting auto-refresh', [
                        'account_id' => $connectedWhatsapp->id,
                        'campaign_id' => $campaign->id,
                        'error_code' => $errorCode,
                    ]);

                    $refreshed = WhatsappTokenRefreshService::refreshTokenForAccount($connectedWhatsapp);
                    if ($refreshed) {
                        $connectedWhatsapp->refresh();
                        $accessToken = $connectedWhatsapp->access_token;
                        $url = "https://graph.facebook.com/v22.0/{$phoneNumberId}/messages?access_token={$accessToken}";

                        // Retry the request with the new token
                        $response = Http::withHeaders([
                            'Authorization' => "Bearer {$accessToken}",
                        ])->post($url, $data);

                        $responseData = $response->json();

                        Log::info('campaignMessage: retried after token refresh', [
                            'account_id' => $connectedWhatsapp->id,
                            'success' => !$response->failed() && !isset($responseData['error']),
                        ]);
                    } else {
                        Log::error('campaignMessage: token refresh failed, cannot retry', [
                            'account_id' => $connectedWhatsapp->id,
                        ]);
                    }
                }

                $campaign->increment('total_send');

                if ($response->failed() || isset($responseData['error'])) {
                    Log::error('campaignMessage failed', [
                        'contact_id' => $contact->id,
                        'campaign_id' => $campaign->id,
                        'status' => $response->status(),
                        'error' => $responseData['error'] ?? null,
                    ]);
                    $this->markCampaignContactFailed($campaign, $contact, 'meta_send_failed', [
                        'http_status' => $response->status(),
                        'error' => $responseData['error'] ?? null,
                    ]);
                    continue;
                }

                $whatsappMessageId = $responseData['messages'][0]['id'] ?? null;
                if (!$whatsappMessageId) {
                    $this->markCampaignContactFailed($campaign, $contact, 'missing_message_id_from_meta', [
                        'http_status' => $response->status(),
                        'payload' => $responseData,
                    ]);
                    continue;
                }

                $message = new Message();
                $message->whatsapp_account_id = $campaign->whatsapp_account_id;
                $message->user_id = $campaign->user_id;
                $message->campaign_id = $campaign->id;
                $message->whatsapp_message_id = $whatsappMessageId;
                $message->conversation_id = $conversation->id;
                $message->template_id = $template->id;
                $message->type = Status::MESSAGE_SENT;
                $message->status = Status::SENT;
                $message->send_at = $attemptedAt;
                $message->ordering = $attemptedAt;

                $conversation->last_message_at = $attemptedAt;
                $conversation->save();

                $message->save();

                $contact->status = Status::CAMPAIGN_MESSAGE_IS_SENT;
                $contact->delivery_status = Status::CAMPAIGN_DELIVERY_SENT;
                $contact->sent_at = $contact->sent_at ?: $attemptedAt;
                $contact->message_id = $message->id;
                $contact->whatsapp_message_id = $whatsappMessageId;
                $contact->meta_error_code = null;
                $contact->meta_error_title = null;
                $contact->meta_error_details = null;
                $contact->save();

                $this->logCampaignEvent(
                    $campaign->id,
                    $contact,
                    'api_accepted',
                    $attemptedAt,
                    'cron',
                    [
                        'http_status' => $response->status(),
                    ],
                    $message->id,
                    $whatsappMessageId
                );

                $this->checkCampaignStatus($campaign->fresh());
            }
        });
    }

    private function markCampaignContactFailed($campaign, CampaignContact $contact, string $reason, array $meta = [], bool $incrementSend = false): void
    {
        $failedAt = now();

        if ($incrementSend) {
            $campaign->increment('total_send');
        }

        if ((int) $contact->status !== (int) Status::CAMPAIGN_MESSAGE_IS_FAILED) {
            $campaign->increment('total_failed');
        }

        $errorCode = (string) ($meta['error']['code'] ?? $meta['error_code'] ?? 'FAILED');
        $errorTitle = (string) ($meta['error']['message'] ?? $meta['error_title'] ?? Str::headline($reason));
        $errorDetails = $meta['error']['error_data']['details'] ?? ($meta['error_details'] ?? null);

        $contact->status = Status::CAMPAIGN_MESSAGE_IS_FAILED;
        $contact->delivery_status = Status::CAMPAIGN_DELIVERY_FAILED;
        $contact->failed_at = $failedAt;
        $contact->meta_error_code = $errorCode;
        $contact->meta_error_title = $errorTitle;
        $contact->meta_error_details = is_array($errorDetails) ? json_encode($errorDetails) : (string) $errorDetails;
        $contact->save();

        $this->logCampaignEvent(
            $campaign->id,
            $contact,
            'failed',
            $failedAt,
            'cron',
            array_merge(['reason' => $reason], $meta),
            $contact->message_id ?: 0,
            $contact->whatsapp_message_id
        );

        $this->checkCampaignStatus($campaign->fresh());
    }

    private function logCampaignEvent(
        int $campaignId,
        CampaignContact $campaignContact,
        string $eventType,
        Carbon $eventTime,
        string $source,
        array $meta = [],
        int $messageId = 0,
        ?string $whatsappMessageId = null
    ): void {
        $eventTs = $eventTime->copy()->startOfSecond();

        CampaignMessageEvent::updateOrCreate(
            [
                'campaign_id' => $campaignId,
                'campaign_contact_id' => $campaignContact->id,
                'whatsapp_message_id' => $whatsappMessageId,
                'event_type' => $eventType,
                'event_ts' => $eventTs,
                'source' => $source,
            ],
            [
                'message_id' => $messageId ?: (int) ($campaignContact->message_id ?? 0),
                'contact_id' => (int) ($campaignContact->contact_id ?? 0),
                'meta_json' => $meta ?: null,
            ]
        );
    }

    public function clearTrashMedia()
    {
        $trashMedia = FlowNodeMedia::whereDoesntHave('node')->where('created_at', '<=', Carbon::now()->subHour())->get();

        foreach ($trashMedia as $media) {
            $filePath = getFilePath('flowBuilderMedia') . '/' . $media->media_path;
            if ($media->media_path && file_exists($filePath)) {
                unlink($filePath);
            }
            $media->delete();
        }
    }

    public function checkCampaignStatus(Campaign $campaign): void
    {
        app(CampaignLifecycleService::class)->reconcile($campaign);
    }

    public function couponExpiration()
    {
        $expiredCoupons = Coupon::whereNot('status', Status::COUPON_EXPIRED)->where('end_date', '<', Carbon::now())->get();
        foreach ($expiredCoupons as $coupon) {
            $coupon->status = Status::COUPON_EXPIRED;
            $coupon->save();
        }
    }

    public function processGroupExtractionJobs(): void
    {
        $jobsPerRun = (int) config('group_extraction.max_jobs_per_cron', 5);
        $rowsPerJob = (int) config('group_extraction.process_rows_per_job', 500);

        try {
            GroupExtractionJob::where('status', Status::GROUP_EXTRACTION_JOB_PROCESSING)
                ->where('updated_at', '<', now()->subMinutes(15))
                ->update([
                    'status' => Status::GROUP_EXTRACTION_JOB_QUEUED,
                    'updated_at' => now(),
                ]);

            $processor = app(GroupExtractionProcessorService::class);
            $processedIds = $processor->processQueuedJobs($jobsPerRun, $rowsPerJob);

            if (!empty($processedIds)) {
                Log::info('group extraction cron processed', [
                    'count' => count($processedIds),
                    'job_ids' => $processedIds,
                ]);
            }
        } catch (\Throwable $exception) {
            Log::error('group extraction cron failed', [
                'message' => $exception->getMessage(),
            ]);

            GroupExtractionJob::whereIn('status', [
                Status::GROUP_EXTRACTION_JOB_PROCESSING,
            ])->where('updated_at', '<', now()->subMinutes(15))
                ->update([
                    'status' => Status::GROUP_EXTRACTION_JOB_QUEUED,
                    'updated_at' => now(),
                ]);
        }
    }
}
