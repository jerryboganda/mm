<?php

namespace App\Http\Controllers;

use App\Models\WhatsappAccount;
use Illuminate\Http\Request;
use App\Models\Campaign;
use App\Models\CampaignContact;
use App\Models\CampaignMessageEvent;
use App\Models\Message;
use App\Models\Contact;
use App\Models\Conversation;
use App\Constants\Status;
use App\Events\ReceiveMessage;
use App\Lib\WhatsApp\AutomationLib;
use App\Lib\WhatsApp\WhatsAppLib;
use App\Models\ContactFlowState;
use App\Models\Flow;
use App\Models\User;
use App\Services\CampaignLifecycleService;
use libphonenumber\PhoneNumberUtil;
use App\Traits\WhatsappManager;
use Carbon\Carbon;
use Exception;
use App\Models\Order;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    use WhatsappManager;

    public function webhookConnect(Request $request)
    {
        $systemWebhookToken = gs('webhook_verify_token');

        if ($systemWebhookToken && $systemWebhookToken != $request->hub_verify_token) {
            return response('Invalid token', 401);
        }

        return response($request->hub_challenge)->header('Content-type', 'plain/text'); // meta need a specific type of response
    }

    public function webhookResponse(Request $request)
    {
        $entry = $request->input('entry', []);
        if (!is_array($entry) || count($entry) === 0) {
            Log::warning('webhook payload ignored: empty entry', [
                'error_context' => 'missing_entry',
            ]);
            return response()->json(['status' => 'ignored'], 200);
        }

        foreach ($entry as $entryIndex => $entryItem) {
            $wabaId = (string) ($entryItem['id'] ?? '');
            if ($wabaId === '') {
                Log::warning('webhook payload ignored: missing waba id', [
                    'entry_index' => $entryIndex,
                    'error_context' => 'missing_waba_id',
                ]);
                continue;
            }

            $whatsappAccount = WhatsappAccount::where('whatsapp_business_account_id', $wabaId)->first();
            if (!$whatsappAccount) {
                Log::warning('webhook payload ignored: unknown waba', [
                    'waba_id' => $wabaId,
                    'entry_index' => $entryIndex,
                    'error_context' => 'unknown_waba',
                ]);
                continue;
            }

            $user = User::active()->find($whatsappAccount->user_id);
            if (!$user) {
                Log::warning('webhook payload ignored: inactive user', [
                    'waba_id' => $wabaId,
                    'account_id' => $whatsappAccount->id,
                    'error_context' => 'inactive_user',
                ]);
                continue;
            }

            $changes = $entryItem['changes'] ?? [];
            if (!is_array($changes) || count($changes) === 0) {
                Log::info('webhook payload ignored: no changes', [
                    'waba_id' => $wabaId,
                    'account_id' => $whatsappAccount->id,
                    'error_context' => 'missing_changes',
                ]);
                continue;
            }

            foreach ($changes as $changeIndex => $change) {
                try {
                    if (!is_array($change) || !isset($change['value']) || !is_array($change['value'])) {
                        Log::warning('webhook change ignored: invalid value', [
                            'waba_id' => $wabaId,
                            'account_id' => $whatsappAccount->id,
                            'change_index' => $changeIndex,
                            'error_context' => 'invalid_change_value',
                        ]);
                        continue;
                    }

                    $field = (string) ($change['field'] ?? '');
                    $metaValue = $change['value'];
                    $statusPayloads = is_array($metaValue['statuses'] ?? null) ? $metaValue['statuses'] : [];
                    $metaMessages = is_array($metaValue['messages'] ?? null) ? $metaValue['messages'] : [];

                    if ($field === 'message_template_status_update') {
                        sleep(10); // wait until template storage is ready
                        $this->templateUpdateNotify($metaValue['message_template_id'] ?? '', $metaValue['event'] ?? '', $metaValue['reason'] ?? '');
                        continue;
                    }

                    foreach ($statusPayloads as $statusIndex => $statusPayload) {
                        if (!is_array($statusPayload)) {
                            continue;
                        }

                        $campaignContactId = $this->handleStatusUpdate($statusPayload, $whatsappAccount);
                        Log::info('webhook status processed', [
                            'waba_id' => $wabaId,
                            'field' => $field,
                            'statuses_count' => count($statusPayloads),
                            'messages_count' => count($metaMessages),
                            'processed_campaign_contact_id' => $campaignContactId,
                            'status_index' => $statusIndex,
                            'error_context' => null,
                        ]);
                    }

                    if (count($metaMessages) > 0) {
                        $this->processInboundMessage($metaValue, $metaMessages[0], $user, $whatsappAccount, [
                            'waba_id' => $wabaId,
                            'field' => $field,
                            'statuses_count' => count($statusPayloads),
                            'messages_count' => count($metaMessages),
                        ]);
                    }
                } catch (\Throwable $exception) {
                    Log::error('webhook change processing failed', [
                        'waba_id' => $wabaId,
                        'account_id' => $whatsappAccount->id,
                        'change_index' => $changeIndex,
                        'error_context' => $exception->getMessage(),
                    ]);
                }
            }
        }

        return response()->json(['status' => 'received'], 200);
    }

    private function processInboundMessage(
        array $metaValue,
        array $metaMessage,
        User $user,
        WhatsappAccount $whatsappAccount,
        array $auditContext = []
    ): void {
        $receiverPhoneNumber = (string) ($metaValue['metadata']['display_phone_number'] ?? '');
        $profileName = $metaValue['contacts'][0]['profile']['name'] ?? null;
        $senderPhoneNumber = (string) ($metaMessage['from'] ?? '');
        $senderId = (string) ($metaMessage['id'] ?? '');

        $messageText = $metaMessage['button']['text'] ?? ($metaMessage['text']['body'] ?? null);
        $messageType = (string) ($metaMessage['type'] ?? 'text');
        $buttonReply = null;
        $listReply = null;
        $mediaId = null;
        $mediaType = null;
        $mediaMimeType = null;
        $messageCaption = null;

        if ($messageType === 'interactive') {
            $buttonReply = $metaMessage['interactive']['button_reply']['title'] ?? null;
            if (isset($metaMessage['interactive']['list_reply'])) {
                $listReply = [
                    'title' => $metaMessage['interactive']['list_reply']['title'] ?? '',
                    'description' => $metaMessage['interactive']['list_reply']['description'] ?? '',
                ];
            }
        }

        if ($messageType !== 'text' && isset($metaMessage[$messageType])) {
            $mediaType = $messageType;
            $mediaId = $metaMessage[$mediaType]['id'] ?? null;
            $mediaMimeType = $metaMessage[$mediaType]['mime_type'] ?? null;
            $messageCaption = $metaMessage[$mediaType]['caption'] ?? null;
        }

        if (!($messageText || $buttonReply || $listReply || $mediaId) || !$senderPhoneNumber || !$senderId) {
            return;
        }

        $receiverPhoneNumber = preg_replace('/\D/', '', $receiverPhoneNumber);
        $phoneUtil = PhoneNumberUtil::getInstance();
        $parseNumber = $phoneUtil->parse('+' . $senderPhoneNumber, '');
        $countryCode = $parseNumber->getCountryCode();
        $nationalNumber = $parseNumber->getNationalNumber();
        $newContact = false;

        $contact = Contact::where('mobile_code', $countryCode)
            ->where('mobile', $nationalNumber)
            ->where('user_id', $user->id)
            ->with('conversation')
            ->first();

        if (!$contact) {
            $newContact = true;
            $contact = new Contact();
            $contact->firstname = $profileName;
            $contact->mobile_code = $countryCode;
            $contact->mobile = $nationalNumber;
            $contact->user_id = $user->id;
            $contact->save();
        }

        $conversation = Conversation::where('contact_id', $contact->id)
            ->where('user_id', $user->id)
            ->where('whatsapp_account_id', $whatsappAccount->id)
            ->first();
        if (!$conversation) {
            $newContact = true;
            $conversation = $this->createConversation($contact, $whatsappAccount);
        }

        $messageExists = Message::where('whatsapp_message_id', $senderId)->exists();
        $whatsappLib = new WhatsAppLib();
        $automationLib = new AutomationLib();

        if (!$messageExists) {
            $message = new Message();
            $message->whatsapp_account_id = $whatsappAccount->id;
            $message->whatsapp_message_id = $senderId;
            $message->user_id = $user->id ?? 0;
            $message->conversation_id = $conversation->id;
            $message->message = $messageText ?? $buttonReply ?? '';
            $message->list_reply = $listReply;
            $message->type = Status::MESSAGE_RECEIVED;
            $message->message_type = getIntMessageType($messageType);
            $message->media_id = $mediaId;
            $message->media_type = $mediaType;
            $message->media_caption = $messageCaption;
            $message->mime_type = $mediaMimeType;
            $message->ordering = Carbon::now();
            $message->save();

            $conversation->last_message_at = Carbon::now();
            $conversation->save();

            $this->attributeInboundReplyToCampaign($message, $contact, $whatsappAccount);

            if ($mediaId) {
                $accessToken = $whatsappAccount->access_token;
                try {
                    $mediaUrl = $whatsappLib->getMediaUrl($mediaId, $accessToken);
                    if ($mediaUrl && $mediaType == 'image') {
                        $mediaPath = $whatsappLib->storedMediaToLocal($mediaUrl['url'], $mediaId, $accessToken, $user->id);
                        $message->media_url = $mediaUrl;
                        $message->media_path = $mediaPath;
                        $message->save();
                    }
                } catch (Exception $ex) {
                    Log::warning('webhook media fetch failed', [
                        'waba_id' => $auditContext['waba_id'] ?? null,
                        'error_context' => $ex->getMessage(),
                    ]);
                }
            }

            if ($messageType == 'order') {
                $orderData = $metaMessage['order'] ?? null;
                if ($orderData) {
                    try {
                        $totalAmount = 0;
                        $currency = 'USD';
                        $products = [];

                        foreach ($orderData['product_items'] as $item) {
                            $totalAmount += $item['item_price'] * $item['quantity'];
                            $currency = $item['currency'];
                            $products[] = [
                                'retailer_id' => $item['product_retailer_id'],
                                'quantity' => $item['quantity'],
                                'price' => $item['item_price'],
                                'currency' => $item['currency']
                            ];
                        }

                        $order = new Order();
                        $order->user_id = $user->id;
                        $order->contact_id = $contact->id;
                        $order->conversation_id = $conversation->id;
                        $order->amount = $totalAmount;
                        $order->currency = $currency;
                        $order->status = 'pending';
                        $order->products_json = $products;
                        $order->save();

                        $whatsappLib->sendAutoReply($user, $conversation, "Order Received: #" . $order->id);
                    } catch (Exception $e) {
                        Log::warning('webhook order process failed', [
                            'waba_id' => $auditContext['waba_id'] ?? null,
                            'error_context' => $e->getMessage(),
                        ]);
                    }
                }
            }

            $html = view('Template::user.inbox.single_message', compact('message'))->render();
            $lastConversationMessageHtml = view("Template::user.inbox.conversation_last_message", compact('message'))->render();

            $this->dispatchReceiveMessageSafely($whatsappAccount->id, [
                'html' => $html,
                'message' => $message,
                'newMessage' => true,
                'newContact' => $newContact,
                'lastMessageHtml' => $lastConversationMessageHtml,
                'unseenMessage' => $conversation->unseenMessages()->count() < 10 ? $conversation->unseenMessages()->count() : '9+',
                'lastMessageAt' => showDateTime(Carbon::now()),
                'conversationId' => $conversation->id,
                'mediaPath' => getFilePath('conversation')
            ], [
                'message_id' => (int) $message->id,
                'whatsapp_message_id' => $message->whatsapp_message_id,
                'context' => 'inbound_message',
            ]);
        }

        $messagesInConversation = Message::where('conversation_id', $conversation->id)
            ->where('type', Status::MESSAGE_RECEIVED)
            ->count();

        if ($messagesInConversation == 1 && @$whatsappAccount->welcomeMessage) {
            $this->sendWelcomeMessage($whatsappAccount, $user, $contact, $conversation);
            return;
        }

        if ($messageExists) {
            return;
        }

        $automationFlowQuery = Flow::where('user_id', $user->id)->with(['nodes', 'nodes.media'])->active();
        $lastState = ContactFlowState::where('conversation_id', $conversation->id)
            ->latest('last_interacted_at')
            ->first();
        $queryText = $buttonReply ?? strtolower((string) $messageText);

        if ($newContact) {
            $automationFlow = $automationFlowQuery->newMessage()->first();
        } else {
            if ($buttonReply && $lastState && $lastState->status == Status::FLOW_STATE_WAITING) {
                $automationFlow = Flow::with('nodes', 'nodes.media')->find($lastState->flow_id);
                if (!$automationFlow) {
                    $automationFlow = $automationFlowQuery->keywordMatch()->where('keyword', $messageText)->first();
                }
            } else {
                $automationFlow = $automationFlowQuery->keywordMatch()->where('keyword', $messageText)->first();
            }
        }

        if ($automationFlow) {
            $automationLib->process($user, $automationFlow, $lastState, $conversation, $queryText);
            return;
        }

        $dialogflowConfig = \App\Models\DialogflowConfig::where('user_id', $user->id)->where('status', 1)->first();
        $dialogflowResponse = null;

        if ($dialogflowConfig) {
            try {
                $dialogflowService = new \App\Lib\Dialogflow\DialogflowService($dialogflowConfig);
                $dialogflowResult = $dialogflowService->detectIntent($conversation->id, $messageText);

                if ($dialogflowResult && !empty($dialogflowResult['fulfillmentText'])) {
                    $dialogflowResponse = $dialogflowResult['fulfillmentText'];
                }
            } catch (\Exception $e) {
                Log::warning('webhook dialogflow failed', [
                    'waba_id' => $auditContext['waba_id'] ?? null,
                    'error_context' => $e->getMessage(),
                ]);
            }
        }

        if ($dialogflowResponse) {
            $request = new Request(['message' => $dialogflowResponse]);
            $messageSend = $whatsappLib->messageSend($request, $conversation->contact->mobileNumber, $whatsappAccount);

            if ($messageSend) {
                extract($messageSend);
                $message = new Message();
                $message->user_id = $user->id;
                $message->whatsapp_account_id = $whatsappAccount->id;
                $message->whatsapp_message_id = $whatsAppMessage[0]['id'];
                $message->conversation_id = $conversation->id;
                $message->type = Status::MESSAGE_SENT;
                $message->message = $dialogflowResponse;
                $message->message_type = getIntMessageType($messageType);
                $message->status = Status::MESSAGE_SENT;
                $message->ordering = Carbon::now();
                $message->save();

                $conversation->last_message_at = Carbon::now();
                $conversation->save();
            }
            return;
        }

        $whatsappLib->sendAutoReply($user, $conversation, $messageText);
    }

    private function handleStatusUpdate(array $statusPayload, WhatsappAccount $whatsappAccount): ?int
    {
        $messageId = $statusPayload['id'] ?? null;
        $messageStatus = strtolower((string) ($statusPayload['status'] ?? ''));

        if (!$messageId || !$messageStatus) {
            return null;
        }

        $wMessage = Message::where('whatsapp_message_id', $messageId)->first();
        if (!$wMessage) {
            return null;
        }

        $wMessage->status = messageStatus($messageStatus);
        $wMessage->save();

        $isNewMessage = false;
        if ($wMessage->status == Status::SENT || $wMessage->status == Status::FAILED) {
            $isNewMessage = true;
        }

        $campaignContactId = $this->syncCampaignDeliveryStatus($wMessage, $statusPayload, $messageStatus);

        $message = $wMessage;
        $html = view('Template::user.inbox.single_message', compact('message'))->render();

        $this->dispatchReceiveMessageSafely($whatsappAccount->id, [
            'html' => $html,
            'messageId' => $message->id,
            'message' => $message,
            'statusHtml' => $message->statusBadge,
            'newMessage' => $isNewMessage,
            'mediaPath' => getFilePath('conversation'),
            'conversationId' => $wMessage->conversation_id,
            'unseenMessage' => $wMessage->conversation ? ($wMessage->conversation->unseenMessages()->count() < 10 ? $wMessage->conversation->unseenMessages()->count() : '9+') : 0,
        ], [
            'message_id' => (int) $message->id,
            'whatsapp_message_id' => $message->whatsapp_message_id,
            'message_status' => $messageStatus,
            'context' => 'status_update',
        ]);

        return $campaignContactId;
    }

    private function syncCampaignDeliveryStatus(Message $message, array $statusPayload, string $messageStatus): ?int
    {
        $campaignContact = $this->resolveCampaignContact($message);
        if (!$campaignContact) {
            return null;
        }

        if ((int) $message->campaign_id <= 0 && (int) $campaignContact->campaign_id > 0) {
            $message->campaign_id = $campaignContact->campaign_id;
            $message->save();
        }

        $campaign = $campaignContact->campaign;
        if (!$campaign) {
            return null;
        }

        $eventAt = $this->statusEventTime($statusPayload);
        $oldStatus = (int) $campaignContact->status;
        $oldDeliveryStatus = (int) ($campaignContact->delivery_status ?? Status::CAMPAIGN_DELIVERY_PENDING);

        if ($oldDeliveryStatus === Status::CAMPAIGN_DELIVERY_FAILED && in_array($messageStatus, ['sent', 'delivered', 'read'], true)) {
            return (int) $campaignContact->id;
        }
        if ($oldDeliveryStatus === Status::CAMPAIGN_DELIVERY_READ && $messageStatus === 'failed') {
            return (int) $campaignContact->id;
        }

        $this->applyMetaContext($campaignContact, $statusPayload);
        $eventType = $messageStatus;

        if ($messageStatus === 'sent') {
            $campaignContact->sent_at = $campaignContact->sent_at ?: $eventAt;
            $campaignContact->status = Status::CAMPAIGN_MESSAGE_IS_SENT;
            $campaignContact->delivery_status = $this->promoteDeliveryStatus($oldDeliveryStatus, Status::CAMPAIGN_DELIVERY_SENT);
        } elseif ($messageStatus === 'delivered') {
            $campaignContact->sent_at = $campaignContact->sent_at ?: $eventAt;
            $campaignContact->delivered_at = $campaignContact->delivered_at ?: $eventAt;
            $campaignContact->status = Status::CAMPAIGN_MESSAGE_IS_SUCCESS;
            $campaignContact->delivery_status = $this->promoteDeliveryStatus($oldDeliveryStatus, Status::CAMPAIGN_DELIVERY_DELIVERED);

            if ($oldStatus !== Status::CAMPAIGN_MESSAGE_IS_SUCCESS) {
                $campaign->increment('total_success');
            }
        } elseif ($messageStatus === 'read') {
            $campaignContact->sent_at = $campaignContact->sent_at ?: $eventAt;
            $campaignContact->delivered_at = $campaignContact->delivered_at ?: $eventAt;
            $campaignContact->read_at = $campaignContact->read_at ?: $eventAt;
            $campaignContact->status = Status::CAMPAIGN_MESSAGE_IS_SUCCESS;
            $campaignContact->delivery_status = $this->promoteDeliveryStatus($oldDeliveryStatus, Status::CAMPAIGN_DELIVERY_READ);

            if ($oldStatus !== Status::CAMPAIGN_MESSAGE_IS_SUCCESS) {
                $campaign->increment('total_success');
            }
        } elseif ($messageStatus === 'failed') {
            $campaignContact->failed_at = $campaignContact->failed_at ?: $eventAt;
            $campaignContact->status = Status::CAMPAIGN_MESSAGE_IS_FAILED;
            $campaignContact->delivery_status = $this->promoteDeliveryStatus($oldDeliveryStatus, Status::CAMPAIGN_DELIVERY_FAILED);

            if ($oldStatus !== Status::CAMPAIGN_MESSAGE_IS_FAILED) {
                $campaign->increment('total_failed');
            }
        } else {
            return (int) $campaignContact->id;
        }

        $campaignContact->save();

        $this->logCampaignEvent(
            $campaignContact,
            $eventType,
            $eventAt,
            'webhook',
            $statusPayload,
            (int) $message->id,
            $message->whatsapp_message_id
        );

        $this->syncCampaignRollupStatus($campaign);
        return (int) $campaignContact->id;
    }

    private function resolveCampaignContact(Message $message): ?CampaignContact
    {
        $campaignContact = CampaignContact::where('message_id', $message->id)
            ->orWhere('whatsapp_message_id', $message->whatsapp_message_id)
            ->latest('id')
            ->first();

        if ($campaignContact) {
            return $campaignContact;
        }

        if ((int) $message->campaign_id > 0 && $message->conversation) {
            return CampaignContact::where('campaign_id', $message->campaign_id)
                ->where('contact_id', $message->conversation->contact_id)
                ->latest('id')
                ->first();
        }

        return null;
    }

    private function attributeInboundReplyToCampaign(Message $incomingMessage, Contact $contact, WhatsappAccount $whatsappAccount): void
    {
        $eventAt = Carbon::parse($incomingMessage->created_at ?? now());
        $campaignContact = CampaignContact::where('contact_id', $contact->id)
            ->whereNotNull('sent_at')
            ->whereNull('responded_at')
            ->where('sent_at', '<=', $eventAt)
            ->whereHas('campaign', function ($query) use ($whatsappAccount, $contact) {
                $query->where('user_id', $contact->user_id)
                    ->where('whatsapp_account_id', $whatsappAccount->id);
            })
            ->orderByDesc('sent_at')
            ->first();

        if (!$campaignContact) {
            return;
        }

        $campaignContact->responded_at = $eventAt;
        $campaignContact->first_response_message_id = $incomingMessage->id;
        $campaignContact->save();

        $this->logCampaignEvent(
            $campaignContact,
            'replied',
            $eventAt,
            'webhook',
            ['message_type' => $incomingMessage->message_type],
            (int) $incomingMessage->id,
            $incomingMessage->whatsapp_message_id
        );
    }

    private function statusEventTime(array $statusPayload): Carbon
    {
        $timestamp = $statusPayload['timestamp'] ?? null;
        if (is_numeric($timestamp)) {
            return Carbon::createFromTimestamp((int) $timestamp);
        }
        return now();
    }

    private function applyMetaContext(CampaignContact $campaignContact, array $statusPayload): void
    {
        $conversation = $statusPayload['conversation'] ?? [];
        $pricing = $statusPayload['pricing'] ?? [];
        $errors = $statusPayload['errors'][0] ?? [];

        $campaignContact->meta_conversation_id = $conversation['id'] ?? $campaignContact->meta_conversation_id;
        $campaignContact->meta_conversation_category = $conversation['origin']['type'] ?? $campaignContact->meta_conversation_category;
        $campaignContact->meta_conversation_type = $conversation['type'] ?? $campaignContact->meta_conversation_type;
        $campaignContact->meta_pricing_model = $pricing['pricing_model'] ?? $campaignContact->meta_pricing_model;
        $campaignContact->meta_pricing_category = $pricing['category'] ?? $campaignContact->meta_pricing_category;
        if (array_key_exists('billable', $pricing)) {
            $campaignContact->meta_billable = (int) ((bool) $pricing['billable']);
        }
        if ($errors) {
            $errorDetails = $errors['error_data']['details'] ?? $errors['message'] ?? $campaignContact->meta_error_details;
            if (is_array($errorDetails)) {
                $errorDetails = json_encode($errorDetails);
            }
            $campaignContact->meta_error_code = (string) ($errors['code'] ?? $campaignContact->meta_error_code);
            $campaignContact->meta_error_title = (string) ($errors['title'] ?? $campaignContact->meta_error_title);
            $campaignContact->meta_error_details = (string) $errorDetails;
        }
    }

    private function promoteDeliveryStatus(int $currentStatus, int $candidateStatus): int
    {
        if ($currentStatus === Status::CAMPAIGN_DELIVERY_READ && $candidateStatus === Status::CAMPAIGN_DELIVERY_FAILED) {
            return $currentStatus;
        }

        $rank = [
            Status::CAMPAIGN_DELIVERY_PENDING => 0,
            Status::CAMPAIGN_DELIVERY_SENT => 1,
            Status::CAMPAIGN_DELIVERY_DELIVERED => 2,
            Status::CAMPAIGN_DELIVERY_READ => 3,
            Status::CAMPAIGN_DELIVERY_FAILED => 4,
        ];

        $currentRank = $rank[$currentStatus] ?? 0;
        $candidateRank = $rank[$candidateStatus] ?? 0;

        if ($candidateRank >= $currentRank) {
            return $candidateStatus;
        }

        return $currentStatus;
    }

    private function syncCampaignRollupStatus(Campaign $campaign): void
    {
        app(CampaignLifecycleService::class)->reconcile($campaign);
    }

    private function logCampaignEvent(
        CampaignContact $campaignContact,
        string $eventType,
        Carbon $eventAt,
        string $source,
        array $meta = [],
        int $messageId = 0,
        ?string $whatsappMessageId = null
    ): void {
        CampaignMessageEvent::updateOrCreate(
            [
                'campaign_id' => (int) $campaignContact->campaign_id,
                'campaign_contact_id' => (int) $campaignContact->id,
                'whatsapp_message_id' => $whatsappMessageId,
                'event_type' => $eventType,
                'event_ts' => $eventAt->copy()->startOfSecond(),
                'source' => $source,
            ],
            [
                'message_id' => $messageId ?: (int) ($campaignContact->message_id ?? 0),
                'contact_id' => (int) ($campaignContact->contact_id ?? 0),
                'meta_json' => $meta ?: null,
            ]
        );
    }

    private function dispatchReceiveMessageSafely(int $whatsappAccountId, array $payload, array $context = []): void
    {
        try {
            event(new ReceiveMessage($whatsappAccountId, $payload));
        } catch (\Throwable $exception) {
            $logContext = [
                'whatsapp_account_id' => $whatsappAccountId,
                'error_context' => $exception->getMessage(),
            ];
            foreach ($context as $key => $value) {
                $logContext[$key] = $value;
            }

            Log::warning('realtime broadcast failed; persisted webhook state kept', $logContext);
        }
    }

    private function createConversation($contact, $whatsappAccount)
    {
        $conversation = new Conversation();
        $conversation->contact_id = $contact->id;
        $conversation->whatsapp_account_id = $whatsappAccount->id;
        $conversation->user_id = $whatsappAccount->user_id;
        $conversation->save();

        return $conversation;
    }
}
