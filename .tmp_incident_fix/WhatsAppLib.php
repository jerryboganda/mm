<?php

namespace App\Lib\WhatsApp;

use App\Constants\Status;
use App\Events\ReceiveMessage;
use App\Lib\AiAssistantLib\Gemini;
use App\Lib\AiAssistantLib\OpenAi;
use App\Lib\CurlRequest;
use App\Models\AiAssistant;
use App\Models\Message;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class WhatsAppLib
{
    private static array $templateHeaderMediaCache = [];

    public function sendInteractiveListMessage($toNumber, $whatsappAccount, $interactiveList)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;

        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";

        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
            'type' => 'interactive'
        ];

        $list = [
            'type' => 'list',
        ];

        if (isset($interactiveList->header) && !empty($interactiveList->header)) {
            $list['header'] = $interactiveList->header;
        }

        $list['body'] = $interactiveList->body;

        if (isset($interactiveList->footer) && !empty($interactiveList->footer)) {
            $list['footer'] = $interactiveList->footer;
        }

        $list['action'] = [
            'button' => $interactiveList->button_text,
            'sections' => $interactiveList->sections
        ];

        $data['interactive'] = $list;

        try {

            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['error_data']['details'] ?? @$responseData['error']['message'] ?? "Something went wrong");
            }

            if ($response->failed()) {
                throw new Exception("Message sending failed");
            }

            return [
                'whatsAppMessage' => $responseData['messages'],
                'interactiveListId' => $interactiveList->id,
                'mediaId' => null,
                'mediaUrl' => null,
                'mediaPath' => null,
                'mediaCaption' => null,
                'mediaFileName' => null,
                'messageType' => 'list',
                'mimeType' => null,
                'mediaType' => null
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function sendCtaUrlMessage($toNumber, $whatsappAccount, $ctaUrl)
    {
        // ... (existing code for sendCtaUrlMessage) ...
        // Keeping existing content, just ensuring context matches.
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";
        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
            'type' => 'interactive'
        ];
        $interactive = [
            'type' => 'cta_url',
            'header' => $ctaUrl->header,
            'body' => $ctaUrl->body,
            'action' => $ctaUrl->action
        ];
        if (!empty($ctaUrl->footer) && count($ctaUrl->footer) > 0) {
            $interactive['footer'] = $ctaUrl->footer;
        }
        $data['interactive'] = $interactive;
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);
            $responseData = $response->json();
            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }
            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['error_data']['details'] ?? @$responseData['error']['message'] ?? "Something went wrong");
            }
            if ($response->failed()) {
                throw new Exception("Message sending failed");
            }
            return [
                'whatsAppMessage' => $responseData['messages'],
                'ctaUrlId' => $ctaUrl->id,
                'mediaId' => null,
                'mediaUrl' => null,
                'mediaPath' => null,
                'mediaCaption' => null,
                'mediaFileName' => null,
                'messageType' => 'url',
                'mimeType' => null,
                'mediaType' => null
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function sendProductMessage($toNumber, $whatsappAccount, $productData)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";

        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
            'type' => 'interactive',
            'interactive' => [
                'type' => 'product',
                'body' => [
                    'text' => $productData['body'] ?? ''
                ],
                'action' => [
                    'catalog_id' => $productData['catalog_id'],
                    'product_retailer_id' => $productData['product_retailer_id']
                ]
            ]
        ];

        if (!empty($productData['footer'])) {
            $data['interactive']['footer'] = ['text' => $productData['footer']];
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['message'] ?? "Something went wrong");
            }

            return [
                'whatsAppMessage' => $responseData['messages']
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function sendMultiProductMessage($toNumber, $whatsappAccount, $productData)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";

        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
            'type' => 'interactive',
            'interactive' => [
                'type' => 'product_list',
                'header' => [
                    'type' => 'text',
                    'text' => $productData['header']
                ],
                'body' => [
                    'text' => $productData['body']
                ],
                'action' => [
                    'catalog_id' => $productData['catalog_id'],
                    'sections' => $productData['sections']
                ]
            ]
        ];

        if (!empty($productData['footer'])) {
            $data['interactive']['footer'] = ['text' => $productData['footer']];
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['message'] ?? "Something went wrong");
            }

            return [
                'whatsAppMessage' => $responseData['messages']
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function updateCommerceSettings($whatsappAccount, $isCartEnabled, $isCatalogVisible)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/whatsapp_commerce_settings";

        $data = [
            'is_cart_enabled' => $isCartEnabled,
            'is_catalog_visible' => $isCatalogVisible
        ];

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error'])) {
                throw new Exception(@$responseData['error']['message'] ?? "Something went wrong");
            }

            return $responseData['success'] ?? true;

        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function sendTemplateMessage($request, $whatsappAccount, $template, $contact, $node = null)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;

        $bodyParams = [];
        $headerParams = [];

        foreach (($request->body_variables ?? []) as $value) {
            $bodyParams[] = [
                'type' => 'text',
                'text' => $value ?? '',
            ];
        }

        foreach (($request->header_variables ?? []) as $value) {
            $headerParams[] = [
                'type' => 'text',
                'text' => $value ?? '',
            ];
        }

        if ($node && !empty($node->header_params)) {
            $headerParams = $node->header_params;
        }

        if ($node && !empty($node->body_params)) {
            $bodyParams = $node->body_params;
        }

        $templateHeaderParams = parseTemplateParams($headerParams, $contact);
        $templateBodyParams = parseTemplateParams($bodyParams, $contact);

        $components = [];

        if (count($template->cards) == 0) {
            if (is_array($templateHeaderParams) && count($templateHeaderParams)) {
                $components[] = [
                    'type' => 'header',
                    'parameters' => $templateHeaderParams
                ];
            } elseif ($template->header_format === 'IMAGE' && !empty($template->header_media)) {
                $headerComponent = $this->buildTemplateImageHeaderComponent($template, $whatsappAccount);
                if (!$headerComponent) {
                    throw new Exception('Template header image is unavailable for sending');
                }
                $components[] = $headerComponent;
            }
        }

        if (is_array($templateBodyParams) && count($templateBodyParams)) {
            $components[] = [
                'type' => 'body',
                'parameters' => $templateBodyParams
            ];
        } else {
            $components[] = [
                'type' => 'body',
                'parameters' => []
            ];
        }

        if (!empty($template->cards) && count($template->cards) > 0) {
            $cards = [];

            foreach ($template->cards as $index => $card) {
                $cardData = [];
                $cardData['card_index'] = $index;
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
            'to' => '+' . $contact->mobileNumber,
            'type' => 'template',
            'template' => [
                'name' => trim($template->name),
                'language' => [
                    'code' => $template->language->code,
                ],
                'components' => $components
            ],
        ];

        try {
            $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages?access_token={$accessToken}";

            $response = Http::withHeaders([
                'Authorization' => "Bearer {$whatsappAccount->access_token}",
            ])->post($url, $data);

            $data = $response->json();

            if ($response->failed() || !is_array($data) || !count($data)) {
                throw new Exception($data['error']['error_data']['details'] ?? $data['error']['message'] ?? "Message sending failed");
            }

            return [
                'whatsAppMessage' => $data['messages']
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? "Something went wrong");
        }
    }

    public function buildTemplateImageHeaderComponent($template, $whatsappAccount): ?array
    {
        if (!$template || strtoupper((string) ($template->header_format ?? '')) !== 'IMAGE' || empty($template->header_media)) {
            return null;
        }

        $cacheKey = implode(':', [
            (int) ($whatsappAccount->id ?? 0),
            (int) ($template->id ?? 0),
            (string) $template->header_media,
            (string) ($whatsappAccount->phone_number_id ?? ''),
        ]);

        $cachedMediaId = self::$templateHeaderMediaCache[$cacheKey] ?? null;
        if (is_string($cachedMediaId) && $cachedMediaId !== '') {
            return $this->toTemplateHeaderImageIdComponent($cachedMediaId);
        }

        $localFilePath = $this->templateHeaderAbsolutePath((string) $template->header_media);
        if ($localFilePath && file_exists($localFilePath)) {
            try {
                $phoneNumberId = (string) ($whatsappAccount->phone_number_id ?? '');
                $accessToken = (string) ($whatsappAccount->access_token ?? '');
                if ($phoneNumberId !== '' && $accessToken !== '') {
                    $mediaEndpoint = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/media";
                    $uploadResponse = $this->uploadMedia($mediaEndpoint, $localFilePath, $accessToken);
                    $mediaId = (string) ($uploadResponse['id'] ?? '');
                    if ($mediaId !== '') {
                        self::$templateHeaderMediaCache[$cacheKey] = $mediaId;
                        return $this->toTemplateHeaderImageIdComponent($mediaId);
                    }
                }
            } catch (\Throwable $exception) {
                Log::warning('template header media upload failed; falling back to link', [
                    'template_id' => (int) ($template->id ?? 0),
                    'whatsapp_account_id' => (int) ($whatsappAccount->id ?? 0),
                    'file' => (string) $template->header_media,
                    'error_context' => $exception->getMessage(),
                ]);
            }
        } else {
            Log::warning('template header media file missing on disk', [
                'template_id' => (int) ($template->id ?? 0),
                'whatsapp_account_id' => (int) ($whatsappAccount->id ?? 0),
                'file' => (string) $template->header_media,
                'path' => $localFilePath,
            ]);
        }

        $publicUrl = $this->templateHeaderPublicUrl((string) $template->header_media);
        if (!$publicUrl) {
            return null;
        }

        return [
            'type' => 'header',
            'parameters' => [
                [
                    'type' => 'image',
                    'image' => [
                        'link' => $publicUrl,
                    ],
                ],
            ],
        ];
    }

    private function toTemplateHeaderImageIdComponent(string $mediaId): array
    {
        return [
            'type' => 'header',
            'parameters' => [
                [
                    'type' => 'image',
                    'image' => [
                        'id' => $mediaId,
                    ],
                ],
            ],
        ];
    }

    private function templateHeaderAbsolutePath(string $fileName): ?string
    {
        $relativeDir = trim((string) getFilePath('templateHeader'), '/');
        if ($relativeDir === '' || trim($fileName) === '') {
            return null;
        }

        return base_path('../' . $relativeDir . '/' . ltrim($fileName, '/'));
    }

    private function templateHeaderPublicUrl(string $fileName): ?string
    {
        $relativePath = trim((string) getFilePath('templateHeader'), '/') . '/' . ltrim($fileName, '/');
        $publicUrl = url($relativePath);
        $host = (string) parse_url($publicUrl, PHP_URL_HOST);

        if ($this->isPrivateWebhookHost($host)) {
            $baseUrl = rtrim((string) config('app.url'), '/');
            if ($baseUrl !== '') {
                $publicUrl = $baseUrl . '/' . ltrim($relativePath, '/');
                $host = (string) parse_url($publicUrl, PHP_URL_HOST);
            }
        }

        if ($this->isPrivateWebhookHost($host)) {
            Log::error('template header media URL resolved to private host', [
                'resolved_url' => $publicUrl,
                'file' => $fileName,
            ]);
            return null;
        }

        return $publicUrl;
    }

    private function isPrivateWebhookHost(?string $host): bool
    {
        $normalized = strtolower(trim((string) $host));
        if ($normalized === '') {
            return true;
        }

        if (in_array($normalized, ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }

        return str_ends_with($normalized, '.local');
    }

    public function messageSend($request, $toNumber, $whatsappAccount)
    {

        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;

        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";
        $mediaLink = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/media";

        $mediaId = null;
        $mediaUrl = null;
        $mediaPath = null;
        $mediaCaption = null;
        $mediaFileName = null;
        $mimeType = null;
        $mediaType = null;

        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
        ];

        if ($request->hasFile('image') || $request->get('image') instanceof UploadedFile) {

            $file = $request->file('image') ?: $request->get('image');
            $mediaUpload = $this->uploadMedia($mediaLink, $file, $accessToken);

            $mediaId = $mediaUpload['id'];
            $mediaCaption = $request->message;
            $data['type'] = 'image';
            $data['image'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption
            ];
            $mediaType = 'image';
            $mimeType = mime_content_type($file->getPathname());
        } else if ($request->hasFile('document') || $request->get('document') instanceof UploadedFile) {
            $file = $request->file('document') ?: $request->get('document');
            $mediaUpload = $this->uploadMedia($mediaLink, $file, $accessToken);
            $mediaId = $mediaUpload['id'];
            $mediaCaption = $request->message;
            $mediaFileName = $request->file('document') ? $request->file('document')->getClientOriginalName() : basename($request->get('document'));
            $data['type'] = 'document';
            $data['document'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption,
                'filename' => $mediaFileName
            ];
            $mediaType = 'document';
            $mimeType = mime_content_type($file->getPathname());
        } else if ($request->hasFile('video') || $request->get('video') instanceof UploadedFile) {
            $file = $request->file('video') ?: $request->get('video');
            $mediaUpload = $this->uploadMedia($mediaLink, $file, $accessToken);
            $mediaId = $mediaUpload['id'];
            $mediaCaption = $request->message;
            $data['type'] = 'video';
            $data['video'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption
            ];
            $mediaType = 'video';
            $mimeType = mime_content_type($file->getPathname());
        } else if ($request->hasFile('audio') || $request->get('audio') instanceof UploadedFile) {
            $file = $request->file('audio') ?: $request->get('audio');
            $mediaUpload = $this->uploadMedia($mediaLink, $file, $accessToken);
            $mediaId = $mediaUpload['id'];
            $mediaCaption = $request->message;
            $data['type'] = 'audio';
            $data['audio'] = [
                'id' => $mediaId
            ];
            $mediaType = 'audio';
            $mimeType = mime_content_type($file->getPathname());
        } else if ($request->latitude && $request->longitude) {
            $data['type'] = 'location';
            $location = [
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
            ];
            if ($request->name != null && $request->address != null) {
                $location['name'] = $request->name;
                $location['address'] = $request->address;
            }
            ;

            $data['location'] = $location;
        } else {
            $data['type'] = 'text';
            $data['text'] = [
                'body' => $request->message
            ];
        }

        try {

            if ($mediaId) {
                $mediaUrl = $this->getMediaUrl($mediaId, $accessToken)['url'];
            }

            if ($mediaId && $mediaUrl && ($request->hasFile('image') || $request->get('image') instanceof UploadedFile || $request->hasFile('audio') || $request->get('audio') instanceof UploadedFile || $request->hasFile('video') || $request->get('video') instanceof UploadedFile)) {
                $mediaPath = $this->storedMediaToLocal($mediaUrl, $mediaId, $accessToken, $whatsappAccount->user_id);
            }
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['message'] ?? "Something went wrong");
            }

            if ($response->failed()) {
                throw new Exception("Message sending failed");
            }

            return [
                'whatsAppMessage' => $responseData['messages'],
                'ctaUrlId' => 0,
                'mediaId' => $mediaId,
                'mediaUrl' => $mediaUrl,
                'mediaPath' => $mediaPath,
                'mediaCaption' => $mediaCaption,
                'mediaFileName' => $mediaFileName,
                'messageType' => $data['type'],
                'mimeType' => $mimeType ?? null,
                'mediaType' => $mediaType ?? null,
                'location' => $data['location'] ?? null
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function messageResend(object $message, $toNumber, $whatsappAccount)
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;

        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";

        $mediaId = $message->media_id ?? null;
        $mediaCaption = $message->media_caption ?? null;
        $mediaFileName = $message->media_filename ?? null;

        $data = [
            'messaging_product' => 'whatsapp',
            'to' => $toNumber,
            'type' => 'text'
        ];

        if ($message->media_id && $message->message_type == Status::IMAGE_TYPE_MESSAGE) {
            $data['type'] = 'image';
            $data['image'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption
            ];
        } else if ($message->media_id && $message->message_type == Status::DOCUMENT_TYPE_MESSAGE) {
            $data['type'] = 'document';
            $data['document'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption,
                'filename' => $mediaFileName
            ];
        } else if ($message->media_id && $message->message_type == Status::VIDEO_TYPE_MESSAGE) {
            $data['type'] = 'video';
            $data['video'] = [
                'id' => $mediaId,
                'caption' => $mediaCaption
            ];
        } else {
            $data['type'] = 'text';
            $data['text'] = [
                'body' => $message->message
            ];
        }

        try {

            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}"
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || !count($responseData)) {
                throw new Exception("Something went wrong");
            }

            if (isset($responseData['error']) || !isset($responseData['messages'])) {
                throw new Exception(@$responseData['error']['message'] ?? "Something went wrong");
            }

            if ($response->failed()) {
                throw new Exception("Message sending failed");
            }

            return [
                'whatsAppMessage' => $responseData['messages']
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function uploadMedia($mediaUrl, $file, $accessToken)
    {
        if ($file instanceof \Illuminate\Http\UploadedFile) {
            $filePath = $file->getRealPath();
            $fileName = $file->getClientOriginalName();
        } elseif ($file instanceof UploadedFile) {
            $filePath = $file->getPathname();
            $fileName = basename($filePath);
        } elseif (is_string($file) && file_exists($file)) {
            $filePath = $file;
            $fileName = basename($file);
        } else {
            throw new Exception('Invalid file provided for upload');
        }

        $response = Http::withToken($accessToken)
            ->attach(
                'file',
                file_get_contents($filePath),
                $fileName
            )
            ->post($mediaUrl, [
                'messaging_product' => 'whatsapp',
            ]);

        $data = $response->json();

        if (!$response->successful() || !isset($data['id'])) {
            $errorMessage = $data['error']['message']
                ?? $data['error']['error_user_msg']
                ?? 'Failed to upload media';
            throw new Exception($errorMessage);
        }

        return $data;
    }

    function getSessionId($appId, array $fileData, $accessToken)
    {
        try {

            $url = "https://graph.facebook.com/v23.0/{$appId}/uploads";
            $response = Http::post($url, [
                'file_name' => $fileData['name'],
                'file_length' => $fileData['size'],
                'file_type' => $fileData['type'],
                'access_token' => $accessToken
            ]);
            $data = $response->json();
            if ($response->failed() || !is_array($data) || !isset($data['id'])) {
                throw new Exception(@$data['error']['message'] ?? "Couldn\'t upload your header image! Please try again later.");
            }
            return $data;
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? "Couldn\'t upload your header image! Please try again later.");
        }
    }

    function getMediaHandle($sessionId, $accessToken, $filePath, $mimeType)
    {
        try {

            $cleanSessionId = str_replace('upload:', '', $sessionId);
            $url = "https://graph.facebook.com/v23.0/upload:$cleanSessionId";
            $fileContents = file_get_contents($filePath);

            $response = Http::withHeaders([
                'Authorization' => "OAuth $accessToken",
                'file_offset' => '0',
            ])->withBody($fileContents, $mimeType)
                ->post($url);

            $data = $response->json();
            if ($response->failed() || !is_array($data) || !isset($data['h'])) {
                throw new Exception(@$data['error']['error_user_msg'] ?? @$data['error']['message']);
            }
            return $data['h'];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? "Failed to get the media handle! Please try again later.");
        }
    }

    public function getMediaUrl($mediaId, $accessToken)
    {
        $url = $this->getWhatsAppBaseUrl() . "{$mediaId}";

        $response = CurlRequest::curlContent($url, [
            "Authorization: Bearer {$accessToken}"
        ]);

        $data = json_decode($response, true);

        if (!is_array($data) || isset($data['error']) || !isset($data['url'])) {
            throw new Exception(@$data['error']['error_user_msg'] ?? @$data['error']['message'] ?? "Failed to load the media URL. Please try again later.");
        }

        return $data;
    }

    public function getWhatsAppBaseUrl()
    {
        return "https://graph.facebook.com/v22.0/";
    }

    public function storedMediaToLocal($mediaUrl, $mediaId, $accessToken, $userId)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}",
            ])->get($mediaUrl);

            if ($response->failed()) {
                throw new Exception("Message sending fail for the download media");
            }

            $fileContent = $response->body();
            $mimeType = $response->header('Content-Type');

            $fileExtension = explode('/', $mimeType)[1];
            $fileName = "{$mediaId}.{$fileExtension}";

            $parentFolder = getFilePath('conversation');
            $subFolder = "{$userId}/" . date('Y/m/d');
            $folderPath = $parentFolder . "/" . $subFolder;
            $filePath = $folderPath . "/" . $fileName;

            if (!file_exists($folderPath)) {
                mkdir($folderPath, 0755, true);
            }

            file_put_contents($filePath, $fileContent);

            return $subFolder . "/" . $fileName;
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage());
        }
    }

    public function submitTemplate($businessAccountId, $accessToken, $templateData = [])
    {
        $header = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ];

        try {

            $response = CurlRequest::curlPostContent($this->getWhatsAppBaseUrl() . "{$businessAccountId}/message_templates", $templateData, $header);
            $data = json_decode($response, true);

            if (!is_array($data) || isset($data['error'])) {
                throw new Exception(@$data['error']['error_user_msg'] ?? @$data['error']['message'] ?? "Something went wrong");
            }
            return $data;
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? "Something went wrong");
        }
    }

    public function sendAutoReply($user, $conversation, $message)
    {
        $this->checkConversationLastMessage($conversation);

        $contact = $conversation->contact;
        $userAiSetting = $user->aiSetting;

        if (!$userAiSetting)
            return;

        if ($userAiSetting->status == Status::DISABLE || !$contact || $conversation->needs_human_reply == Status::YES)
            return;

        $provider = [
            'openai' => OpenAi::class,
            'gemini' => Gemini::class
        ];

        $activeProvider = AiAssistant::active()->first();

        if (!$activeProvider)
            return;

        if ($user->ai_assistance == 0)
            return;

        $aiAssistantClass = $provider[$activeProvider->provider];

        $aiAssistant = new $aiAssistantClass();

        if ($userAiSetting->status == Status::ENABLE) {
            $systemPrompt = $userAiSetting->system_prompt;
            $aiResponse = $aiAssistant->getAiReply($systemPrompt, $message);
            $whatsappAccount = $user->currentWhatsapp();

            if ($aiResponse['success'] == true) {
                if ($aiResponse['response'] == null && $userAiSetting->fallback_response != null) {
                    $request = new Request([
                        'message' => $userAiSetting->fallback_response,
                    ]);
                    $conversation->needs_human_reply = Status::YES;
                    $conversation->save();
                } else {
                    $request = new Request([
                        'message' => $aiResponse['response'],
                    ]);
                }

                $messageSend = $this->messageSend($request, $contact->mobileNumber, $whatsappAccount);
                extract($messageSend);

                $message = new Message();
                $message->user_id = $user->id;
                $message->whatsapp_account_id = $whatsappAccount->id;
                $message->whatsapp_message_id = $whatsAppMessage[0]['id'];
                $message->conversation_id = $conversation->id;
                $message->type = Status::MESSAGE_SENT;
                $message->message = $request->message;
                $message->media_id = $mediaId;
                $message->message_type = getIntMessageType($messageType);
                ;
                $message->media_caption = $mediaCaption;
                $message->media_filename = $mediaFileName;
                $message->media_url = $mediaUrl;
                $message->media_path = $mediaPath;
                $message->mime_type = $mimeType;
                $message->media_type = $mediaType;
                $message->status = Status::MESSAGE_SENT;
                $message->ordering = Carbon::now();
                $message->ai_reply = Status::YES;
                $message->save();

                $conversation->last_message_at = Carbon::now();
                $conversation->save();

                $html = view('Template::user.inbox.single_message', compact('message'))->render();
                $lastConversationMessageHtml = view("Template::user.inbox.conversation_last_message", compact('message'))->render();

                event(new ReceiveMessage($whatsappAccount->id, [
                    'html' => $html,
                    'message' => $message,
                    'newMessage' => true,
                    'newContact' => false,
                    'lastMessageHtml' => $lastConversationMessageHtml,
                    'unseenMessage' => $conversation->unseenMessages()->count() < 10 ? $conversation->unseenMessages()->count() : '9+',
                    'lastMessageAt' => showDateTime(Carbon::now()),
                    'conversationId' => $conversation->id,
                    'mediaPath' => getFilePath('conversation')
                ]));
            }
        }
    }

    private function checkConversationLastMessage($conversation)
    {
        $lastMessage = Message::latest('id')->where('conversation_id', $conversation->id)->skip(1)->first();
        if ($lastMessage && $lastMessage->created_at->diffInHours(Carbon::now()) > 12) {
            $conversation->needs_human_reply = Status::NO;
            $conversation->save();
        }
    }

    public function userBlockAction($whatsappAccount, $contact, $action = 'block')
    {
        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/block_users";

        $data = [
            'messaging_product' => 'whatsapp',
            'block_users' => [
                [
                    'user' => $contact->mobileNumber,
                ]
            ]
        ];

        try {
            if ($action == 'unblock') {
                $message = "Failed to unblock the user! Please try again later.";
                $response = Http::withHeaders([
                    'Authorization' => "Bearer {$accessToken}",
                ])->delete($url, $data);
            } else {
                $message = "Failed to block the user! Please try again later.";
                $response = Http::withHeaders([
                    'Authorization' => "Bearer {$accessToken}",
                ])->post($url, $data);
            }

            $responseData = $response->json();

            if (!is_array($responseData) || $response->failed() || isset($responseData['error']) || !isset($responseData['block_users'])) {
                throw new Exception(
                    @$responseData['error']['error_user_msg']
                    ?? @$responseData['error']['message']
                    ?? $message
                );
            }

            return $responseData;
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? $message);
        }
    }

    public function sendButtonMessage($toNumber, $whatsappAccount, $button)
    {

        $phoneNumberId = $whatsappAccount->phone_number_id;
        $accessToken = $whatsappAccount->access_token;
        $url = $this->getWhatsAppBaseUrl() . "{$phoneNumberId}/messages";

        $data = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $toNumber,
            'type' => 'interactive'
        ];

        $buttonData = json_decode($button->buttons_json, true);

        $interactive = [
            'type' => 'button'
        ];

        $interactive['body'] = [
            'text' => $buttonData['body']
        ];

        $interactive['footer'] = [
            'text' => $buttonData['footer']
        ];


        foreach ($buttonData['buttons'] as $button) {
            $interactive['action']['buttons'][] = [
                'type' => 'reply',
                'reply' => [
                    'id' => $button['text'],
                    'title' => $button['text']
                ]
            ];
        }

        $data['interactive'] = $interactive;

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$accessToken}",
            ])->post($url, $data);

            $responseData = $response->json();

            if (!is_array($responseData) || $response->failed() || isset($responseData['error'])) {
                throw new Exception(
                    @$responseData['error']['error_user_msg']
                    ?? @$responseData['error']['message']
                    ?? "Failed to send the message! Please try again later."
                );
            }

            return [
                'whatsAppMessage' => $responseData['messages'],
                'ctaUrlId' => 0,
                'mediaId' => null,
                'mediaUrl' => null,
                'mediaPath' => null,
                'mediaCaption' => null,
                'mediaFileName' => null,
                'messageType' => 'button',
                'mimeType' => null,
                'mediaType' => null
            ];
        } catch (Exception $ex) {
            throw new Exception($ex->getMessage() ?? "Failed to send the message! Please try again later.");
        }
    }
}
