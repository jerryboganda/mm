<?php

namespace App\Services;

use App\Constants\Status;
use App\Models\Campaign;
use App\Models\CampaignContact;
use Carbon\Carbon;

class CampaignLifecycleService
{
    public function reconcile(Campaign $campaign): Campaign
    {
        $query = CampaignContact::where('campaign_id', $campaign->id);

        $targeted = (int) $query->count();
        if ($targeted <= 0) {
            $targeted = (int) ($campaign->total_message ?? 0);
        }

        if ($targeted <= 0) {
            return $campaign;
        }

        $notSent = (int) (clone $query)
            ->where('status', Status::CAMPAIGN_MESSAGE_NOT_SENT)
            ->count();

        $attempted = (int) (clone $query)
            ->where(function ($builder) {
                $builder->where('status', '!=', Status::CAMPAIGN_MESSAGE_NOT_SENT)
                    ->orWhereNotNull('message_id')
                    ->orWhereNotNull('whatsapp_message_id');
            })
            ->count();

        $failed = (int) (clone $query)
            ->where(function ($builder) {
                $builder->where('status', Status::CAMPAIGN_MESSAGE_IS_FAILED)
                    ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_FAILED)
                    ->orWhereNotNull('failed_at');
            })
            ->count();

        $terminal = (int) (clone $query)
            ->where(function ($builder) {
                $builder->whereIn('delivery_status', [
                    Status::CAMPAIGN_DELIVERY_DELIVERED,
                    Status::CAMPAIGN_DELIVERY_READ,
                    Status::CAMPAIGN_DELIVERY_FAILED,
                ])
                ->orWhereNotNull('delivered_at')
                ->orWhereNotNull('read_at')
                ->orWhereNotNull('failed_at')
                ->orWhere('status', Status::CAMPAIGN_MESSAGE_IS_FAILED);
            })
            ->count();

        $nextStatus = (int) $campaign->status;
        if ($terminal >= $targeted) {
            $nextStatus = $failed >= $targeted ? Status::CAMPAIGN_FAILED : Status::CAMPAIGN_COMPLETED;
        } elseif ($notSent > 0) {
            if ((int) $campaign->status === Status::CAMPAIGN_SCHEDULED && $campaign->send_at) {
                try {
                    $nextStatus = Carbon::parse($campaign->send_at)->isFuture()
                        ? Status::CAMPAIGN_SCHEDULED
                        : Status::CAMPAIGN_RUNNING;
                } catch (\Throwable $e) {
                    $nextStatus = Status::CAMPAIGN_RUNNING;
                }
            } else {
                $nextStatus = Status::CAMPAIGN_RUNNING;
            }
        } elseif ($attempted >= $targeted) {
            $nextStatus = Status::CAMPAIGN_SETTLING;
        } else {
            $nextStatus = Status::CAMPAIGN_RUNNING;
        }

        if ((int) $campaign->status !== $nextStatus) {
            $campaign->status = $nextStatus;
            $campaign->save();
        }

        return $campaign;
    }
}
