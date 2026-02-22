<?php

namespace App\Services;

use App\Constants\Status;
use App\Models\Campaign;
use App\Models\CampaignContact;
use App\Models\CampaignMessageEvent;
use App\Models\CampaignMetaAnalyticsSnapshot;
use App\Models\LinkLog;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class CampaignReportAnalyticsService
{
    private const CACHE_TTL_SECONDS = 30;

    public function getReport(Campaign $campaign, array $filters = []): array
    {
        $tz = $this->resolveTimezone($filters['tz'] ?? null);
        $from = $this->parseFilterDate($filters['from'] ?? null, true, $tz);
        $to = $this->parseFilterDate($filters['to'] ?? null, false, $tz);

        $touchToken = $this->getTouchToken($campaign->id);
        $cacheKey = 'campaign_report_analytics:' . $campaign->id . ':' . md5(json_encode([
            'from' => optional($from)->toDateTimeString(),
            'to' => optional($to)->toDateTimeString(),
            'tz' => $tz,
            'touch' => $touchToken,
        ]));

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($campaign, $from, $to, $tz) {
            return $this->buildReport($campaign, $from, $to, $tz);
        });
    }

    private function buildReport(Campaign $campaign, ?Carbon $from, ?Carbon $to, string $tz): array
    {
        $contactsQuery = CampaignContact::where('campaign_id', $campaign->id);
        $contactsQuery = $this->applyDateFilter($contactsQuery, $from, $to);

        $targeted = (int) $contactsQuery->count();
        $hasDateFilter = $from !== null || $to !== null;
        if (!$hasDateFilter && $targeted === 0) {
            $targeted = (int) $campaign->total_message;
        }

        $apiAttempted = (int) (clone $contactsQuery)->where(function ($query) {
            $query->where('status', '!=', Status::CAMPAIGN_MESSAGE_NOT_SENT)
                ->orWhereNotNull('message_id')
                ->orWhereNotNull('whatsapp_message_id');
        })->count();

        $apiAccepted = (int) (clone $contactsQuery)->where(function ($query) {
            $query->whereNotNull('message_id')->orWhereNotNull('whatsapp_message_id');
        })->count();

        $queued = (int) (clone $contactsQuery)->where('status', Status::CAMPAIGN_MESSAGE_NOT_SENT)->count();

        $sent = (int) (clone $contactsQuery)->where(function ($query) {
            $query->whereNotNull('sent_at')
                ->orWhereIn('delivery_status', [
                    Status::CAMPAIGN_DELIVERY_SENT,
                    Status::CAMPAIGN_DELIVERY_DELIVERED,
                    Status::CAMPAIGN_DELIVERY_READ,
                    Status::CAMPAIGN_DELIVERY_FAILED,
                ]);
        })->count();

        $delivered = (int) (clone $contactsQuery)->where(function ($query) {
            $query->whereNotNull('delivered_at')
                ->orWhereIn('delivery_status', [
                    Status::CAMPAIGN_DELIVERY_DELIVERED,
                    Status::CAMPAIGN_DELIVERY_READ,
                ]);
        })->count();

        $read = (int) (clone $contactsQuery)->where(function ($query) {
            $query->whereNotNull('read_at')
                ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_READ);
        })->count();

        $failed = (int) (clone $contactsQuery)->where(function ($query) {
            $query->where('status', Status::CAMPAIGN_MESSAGE_IS_FAILED)
                ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_FAILED);
        })->count();

        $pendingDelivery = max($apiAccepted - $delivered - $failed, 0);
        $replied = (int) (clone $contactsQuery)->whereNotNull('responded_at')->count();
        $clicked = $this->getUniqueClickers($campaign, $from, $to);

        $firstResponseDurations = $this->pluckDurationSeconds(
            (clone $contactsQuery)->whereNotNull('responded_at')->whereNotNull('sent_at'),
            'sent_at',
            'responded_at'
        );

        $sendToDeliverDurations = $this->pluckDurationSeconds(
            (clone $contactsQuery)->whereNotNull('delivered_at')->whereNotNull('sent_at'),
            'sent_at',
            'delivered_at'
        );

        $deliverToReadDurations = $this->pluckDurationSeconds(
            (clone $contactsQuery)->whereNotNull('read_at')->whereNotNull('delivered_at'),
            'delivered_at',
            'read_at'
        );

        $failureBreakdown = (clone $contactsQuery)
            ->where(function ($query) {
                $query->where('delivery_status', Status::CAMPAIGN_DELIVERY_FAILED)
                    ->orWhere('status', Status::CAMPAIGN_MESSAGE_IS_FAILED);
            })
            ->selectRaw("COALESCE(meta_error_code, 'unknown') AS error_code, COALESCE(meta_error_title, 'Unknown Error') AS error_title, COUNT(*) AS total")
            ->groupBy('error_code', 'error_title')
            ->orderByDesc('total')
            ->get();

        $timeline = $this->buildTimeline($campaign->id, $from, $to, $tz);
        $metaEstimated = $this->latestMetaSnapshots($campaign->id);
        $health = $this->buildHealth($campaign, $pendingDelivery);

        return [
            'legacy_mode' => (int) ($campaign->analytics_version ?? 1) < 2,
            'summary' => [
                'targeted' => $targeted,
                'queued' => $queued,
                'api_attempted' => $apiAttempted,
                'api_accepted' => $apiAccepted,
                'sent' => $sent,
                'delivered' => $delivered,
                'read' => $read,
                'failed' => $failed,
                'pending_delivery' => $pendingDelivery,
            ],
            'engagement' => [
                'replied' => $replied,
                'clicked' => $clicked,
                'reply_rate' => $this->percentage($replied, $delivered),
                'ctr' => $this->percentage($clicked, $delivered),
                'opened_rate' => $this->percentage($read, $delivered),
                'delivery_rate' => $this->percentage($delivered, $targeted),
                'avg_first_response_seconds' => $this->average($firstResponseDurations),
                'median_first_response_seconds' => $this->median($firstResponseDurations),
                'avg_send_to_deliver_seconds' => $this->average($sendToDeliverDurations),
                'avg_deliver_to_read_seconds' => $this->average($deliverToReadDurations),
            ],
            'failures' => [
                'breakdown' => $failureBreakdown,
            ],
            'timeline' => $timeline,
            'meta_estimated' => $metaEstimated,
            'health' => $health,
        ];
    }

    private function buildTimeline(int $campaignId, ?Carbon $from, ?Carbon $to, string $tz): array
    {
        $query = CampaignMessageEvent::where('campaign_id', $campaignId)->whereNotNull('event_ts');
        if ($from) {
            $query->where('event_ts', '>=', $from);
        }
        if ($to) {
            $query->where('event_ts', '<=', $to);
        }

        $rows = $query->get(['event_type', 'event_ts']);
        $daily = [];

        foreach ($rows as $row) {
            if (!$row->event_ts) {
                continue;
            }

            $eventDate = $row->event_ts->copy()->setTimezone($tz)->toDateString();
            $this->ensureTimelineBucket($daily, $eventDate);

            $eventType = (string) $row->event_type;
            if (array_key_exists($eventType, $daily[$eventDate])) {
                $daily[$eventDate][$eventType]++;
            }
        }

        if (empty($daily)) {
            $this->buildTimelineFromContacts($campaignId, $from, $to, $tz, $daily);
        }

        ksort($daily);

        return [
            'daily' => array_values($daily),
        ];
    }

    private function buildTimelineFromContacts(int $campaignId, ?Carbon $from, ?Carbon $to, string $tz, array &$daily): void
    {
        $contactsQuery = CampaignContact::where('campaign_id', $campaignId)->select([
            'send_at',
            'sent_at',
            'delivered_at',
            'read_at',
            'failed_at',
            'responded_at',
            'message_id',
            'whatsapp_message_id',
            'delivery_status',
            'created_at',
        ]);

        $contactsQuery = $this->applyDateFilter($contactsQuery, $from, $to);
        $contacts = $contactsQuery->get();

        foreach ($contacts as $contact) {
            $apiAcceptedAt = $this->timelineDate($contact->sent_at ?: $contact->send_at ?: $contact->created_at, $tz);
            if (($contact->message_id || $contact->whatsapp_message_id) && $apiAcceptedAt) {
                $this->incrementTimelineCounter($daily, $apiAcceptedAt, 'api_accepted');
            }

            if ($contact->sent_at || in_array((int) $contact->delivery_status, [
                Status::CAMPAIGN_DELIVERY_SENT,
                Status::CAMPAIGN_DELIVERY_DELIVERED,
                Status::CAMPAIGN_DELIVERY_READ,
                Status::CAMPAIGN_DELIVERY_FAILED,
            ], true)) {
                $sentAt = $this->timelineDate($contact->sent_at ?: $contact->send_at ?: $contact->created_at, $tz);
                if ($sentAt) {
                    $this->incrementTimelineCounter($daily, $sentAt, 'sent');
                }
            }

            $deliveredAt = $this->timelineDate($contact->delivered_at, $tz);
            if ($deliveredAt) {
                $this->incrementTimelineCounter($daily, $deliveredAt, 'delivered');
            }

            $readAt = $this->timelineDate($contact->read_at, $tz);
            if ($readAt) {
                $this->incrementTimelineCounter($daily, $readAt, 'read');
            }

            $failedAt = $this->timelineDate($contact->failed_at, $tz);
            if ($failedAt) {
                $this->incrementTimelineCounter($daily, $failedAt, 'failed');
            }

            $repliedAt = $this->timelineDate($contact->responded_at, $tz);
            if ($repliedAt) {
                $this->incrementTimelineCounter($daily, $repliedAt, 'replied');
            }
        }
    }

    private function ensureTimelineBucket(array &$daily, string $eventDate): void
    {
        if (isset($daily[$eventDate])) {
            return;
        }

        $daily[$eventDate] = [
            'event_date' => $eventDate,
            'sent' => 0,
            'delivered' => 0,
            'read' => 0,
            'failed' => 0,
            'replied' => 0,
            'api_accepted' => 0,
        ];
    }

    private function incrementTimelineCounter(array &$daily, string $eventDate, string $metric): void
    {
        $this->ensureTimelineBucket($daily, $eventDate);
        if (array_key_exists($metric, $daily[$eventDate])) {
            $daily[$eventDate][$metric]++;
        }
    }

    private function timelineDate($value, string $tz): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value)->setTimezone($tz)->toDateString();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function latestMetaSnapshots(int $campaignId): array
    {
        $snapshots = CampaignMetaAnalyticsSnapshot::where('campaign_id', $campaignId)
            ->orderByDesc('fetched_at')
            ->get()
            ->groupBy('source_type')
            ->map(function (Collection $items) {
                return $items->first();
            })
            ->values();

        return $snapshots->toArray();
    }

    private function getUniqueClickers(Campaign $campaign, ?Carbon $from, ?Carbon $to): int
    {
        $query = $campaign->linkLogs()
            ->select('contact_id')
            ->whereNotNull('contact_id')
            ->distinct();

        if ($from) {
            $query->where('created_at', '>=', $from);
        }
        if ($to) {
            $query->where('created_at', '<=', $to);
        }

        return (int) $query->count('contact_id');
    }

    private function pluckDurationSeconds($query, string $startColumn, string $endColumn): array
    {
        return $query->selectRaw("TIMESTAMPDIFF(SECOND, {$startColumn}, {$endColumn}) AS duration_seconds")
            ->pluck('duration_seconds')
            ->map(function ($value) {
                return (int) $value;
            })
            ->filter(function ($value) {
                return $value >= 0;
            })
            ->values()
            ->all();
    }

    private function percentage(int $value, int $total): float
    {
        if ($total <= 0) {
            return 0.0;
        }
        return round(($value / $total) * 100, 2);
    }

    private function average(array $numbers): int
    {
        if (count($numbers) === 0) {
            return 0;
        }
        return (int) round(array_sum($numbers) / count($numbers));
    }

    private function median(array $numbers): int
    {
        if (count($numbers) === 0) {
            return 0;
        }

        sort($numbers);
        $count = count($numbers);
        $middle = intdiv($count, 2);

        if ($count % 2 === 0) {
            return (int) round(($numbers[$middle - 1] + $numbers[$middle]) / 2);
        }

        return (int) $numbers[$middle];
    }

    private function buildHealth(Campaign $campaign, int $pendingDelivery): array
    {
        $lastWebhookEvent = CampaignMessageEvent::where('campaign_id', $campaign->id)
            ->where('source', 'webhook')
            ->max('event_ts');

        $hasWebhookEvents = !empty($lastWebhookEvent);
        $pendingWithoutWebhookMinutes = 0;

        if ($pendingDelivery > 0 && !$hasWebhookEvents) {
            $anchor = CampaignMessageEvent::where('campaign_id', $campaign->id)
                ->where('event_type', 'api_accepted')
                ->max('event_ts');

            try {
                $start = Carbon::parse($anchor ?: ($campaign->send_at ?: $campaign->created_at));
                $pendingWithoutWebhookMinutes = max((int) round($start->diffInMinutes(now())), 0);
            } catch (\Throwable $e) {
                $pendingWithoutWebhookMinutes = 0;
            }
        }

        return [
            'has_webhook_events' => $hasWebhookEvents,
            'last_webhook_event_at' => $lastWebhookEvent,
            'pending_without_webhook_minutes' => $pendingWithoutWebhookMinutes,
        ];
    }

    private function applyDateFilter($query, ?Carbon $from, ?Carbon $to)
    {
        if ($from) {
            $query->whereRaw('COALESCE(send_at, created_at) >= ?', [$from->toDateTimeString()]);
        }
        if ($to) {
            $query->whereRaw('COALESCE(send_at, created_at) <= ?', [$to->toDateTimeString()]);
        }

        return $query;
    }

    private function parseFilterDate(?string $date, bool $start, string $tz): ?Carbon
    {
        if (!$date) {
            return null;
        }

        try {
            $parsed = Carbon::parse($date, $tz);
            $parsed = $start ? $parsed->startOfDay() : $parsed->endOfDay();
            return $parsed->setTimezone(config('app.timezone'));
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function resolveTimezone(?string $tz): string
    {
        if (!is_string($tz) || trim($tz) === '') {
            return config('app.timezone');
        }

        try {
            Carbon::now($tz);
            return $tz;
        } catch (\Throwable $e) {
            return config('app.timezone');
        }
    }

    private function getTouchToken(int $campaignId): string
    {
        $campaignTouch = Campaign::whereKey($campaignId)->value('updated_at');
        $contactTouch = CampaignContact::where('campaign_id', $campaignId)->max('updated_at');
        $eventTouch = CampaignMessageEvent::where('campaign_id', $campaignId)->max('updated_at');
        $snapshotTouch = CampaignMetaAnalyticsSnapshot::where('campaign_id', $campaignId)->max('updated_at');
        $linkLogTouch = LinkLog::where('campaign_id', $campaignId)->max('updated_at');

        return implode('|', [
            (string) ($campaignTouch ?? ''),
            (string) ($contactTouch ?? ''),
            (string) ($eventTouch ?? ''),
            (string) ($snapshotTouch ?? ''),
            (string) ($linkLogTouch ?? ''),
        ]);
    }
}
