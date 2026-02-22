<?php

namespace App\Http\Controllers\User;

use App\Constants\Status;
use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignContact;
use App\Models\ContactList;
use App\Models\ContactTag;
use App\Models\LinkLog;
use App\Models\Template;
use App\Models\WhatsappAccount;
use App\Services\CampaignReportAnalyticsService;
use App\Services\MetaCampaignAnalyticsService;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CampaignController extends Controller
{
    public function index()
    {
        $user = getParentUser();
        $pageTitle = "Manage Campaign";
        $baseQuery = Campaign::where('user_id', $user->id)
            ->where('whatsapp_account_id', getWhatsappAccountId($user))
            ->with('template')
            ->withCount([
                'campaignContacts as report_targeted',
                'campaignContacts as report_sent' => function ($query) {
                    $query->where(function ($subQuery) {
                        $subQuery->whereNotNull('sent_at')
                            ->orWhereIn('delivery_status', [
                                Status::CAMPAIGN_DELIVERY_SENT,
                                Status::CAMPAIGN_DELIVERY_DELIVERED,
                                Status::CAMPAIGN_DELIVERY_READ,
                                Status::CAMPAIGN_DELIVERY_FAILED,
                            ]);
                    });
                },
                'campaignContacts as report_delivered' => function ($query) {
                    $query->where(function ($subQuery) {
                        $subQuery->whereNotNull('delivered_at')
                            ->orWhereIn('delivery_status', [
                                Status::CAMPAIGN_DELIVERY_DELIVERED,
                                Status::CAMPAIGN_DELIVERY_READ,
                            ]);
                    });
                },
                'campaignContacts as report_failed' => function ($query) {
                    $query->where(function ($subQuery) {
                        $subQuery->where('status', Status::CAMPAIGN_MESSAGE_IS_FAILED)
                            ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_FAILED);
                    });
                },
            ])
            ->searchable(['title'])
            ->filter(['status'])
            ->orderBy('id', 'desc');
        if (request()->export) {
            return exportData($baseQuery, request()->export, "campaign", "A4 landscape");
        }
        $campaigns = $baseQuery->paginate(getPaginate());
        $hasActiveCampaigns = $campaigns->getCollection()->contains(function ($campaign) {
            return in_array((int) $campaign->status, [Status::CAMPAIGN_RUNNING, Status::CAMPAIGN_SCHEDULED], true);
        });

        return view('Template::user.campaign.index', compact('pageTitle', 'campaigns', 'hasActiveCampaigns'));
    }

    public function createCampaign()
    {
        $user = getParentUser();
        $pageTitle = "New Campaign";
        $contactLists = ContactList::where('user_id', $user->id)->with('contact')->orderBy('name', 'asc')->get();
        $contactTags = ContactTag::where('user_id', $user->id)->with('contacts')->orderBy('name', 'asc')->get();
        $templates = Template::where('user_id', $user->id)->approved()->orderBy('id', 'desc')->get();
        $whatsappAccounts = WhatsappAccount::where('user_id', $user->id)->with('templates')->get();

        return view('Template::user.campaign.create', compact('pageTitle', 'contactLists', 'templates', 'whatsappAccounts', 'contactTags'));
    }

    public function createWizard()
    {
        $user = getParentUser();
        $pageTitle = "Broadcast Wizard";
        $contactLists = ContactList::where('user_id', $user->id)->with('contact')->orderBy('name', 'asc')->get();
        $contactTags = ContactTag::where('user_id', $user->id)->with('contacts')->orderBy('name', 'asc')->get();
        $templates = Template::where('user_id', $user->id)->approved()->orderBy('id', 'desc')->get();
        $whatsappAccounts = WhatsappAccount::where('user_id', $user->id)->with('templates')->get();

        return view('Template::user.campaign.wizard', compact('pageTitle', 'contactLists', 'templates', 'whatsappAccounts', 'contactTags'));
    }

    public function saveCampaign(Request $request)
    {
        $request->validate([
            'title' => 'required',
            'contact_lists' => 'required',
            'template_id' => 'required',
            'whatsapp_account_id' => 'required',
            'schedule' => 'nullable|in:on,off',
            'scheduled_at' => 'required_if:schedule,on|date',
            'schedule_timezone' => 'nullable|timezone',
        ]);

        $user = getParentUser();
        $whatsappAccount = WhatsappAccount::where('user_id', $user->id)
            ->where('id', $request->whatsapp_account_id)
            ->with('templates')
            ->first();

        if (!$whatsappAccount) {
            return responseManager('invalid', 'The selected whatsapp account is invalid');
        }

        if (!featureAccessLimitCheck($user->campaign_limit)) {
            return responseManager('subscription_required', 'You have reached the maximum limit of campaigns');
        }

        if ($request->schedule == 'on') {
            $timezone = $request->schedule_timezone ?? config('app.timezone');
            $scheduledTime = Carbon::parse($request->scheduled_at, $timezone);

            if ($scheduledTime->isPast()) {
                return responseManager('future_date_required', 'Scheduled date must be future date');
            }
        }

        $campaignExists = Campaign::where('user_id', $user->id)->where("title", $request->title)->first();

        if ($campaignExists) {
            return responseManager('exists', 'The campaign title already exists');
        }
        $template = Template::where('user_id', $user->id)
            ->approved()
            ->with('language')
            ->where('id', $request->template_id)
            ->first();

        if (!$template) {
            return responseManager('not_found', 'The selected template is not found');
        }
        if ($template->whatsapp_account_id != $whatsappAccount->id) {
            return responseManager('same_required', 'The selected whatsapp account & template whatsapp account id must be same');
        }

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


        $contactIds = [];

        if ($request->raw_numbers) {
            $rawNumbers = preg_split('/[\s,]+/', $request->raw_numbers, -1, PREG_SPLIT_NO_EMPTY);
            $rawNumbers = array_unique($rawNumbers);

            if (count($rawNumbers) > 0) {
                $newList = new ContactList();
                $newList->user_id = $user->id;
                $newList->name = "Quick Import - " . now()->format('d M Y H:i');
                $newList->status = Status::ENABLE;
                $newList->save();

                $newContactIds = [];
                foreach ($rawNumbers as $number) {
                    $number = preg_replace('/[^0-9]/', '', $number);
                    if (empty($number)) {
                        continue;
                    }

                    $contact = \App\Models\Contact::firstOrCreate(
                        ['user_id' => $user->id, 'mobile' => $number],
                        ['name' => $number]
                    );
                    $newContactIds[] = $contact->id;
                }

                $newList->contact()->sync($newContactIds);

                $lists = $request->contact_lists ?? [];
                $lists[] = $newList->id;
                $request->merge(['contact_lists' => $lists]);
            }
        }

        $contactIdsFromList = ContactList::where('user_id', getParentUser()->id)
            ->whereIn('id', $request->contact_lists ?? [])
            ->with('contact')
            ->get()
            ->flatMap(fn($contactList) => $contactList->contact->where('is_blocked', Status::NO)->pluck('id'))
            ->toArray();

        $contactIdsFromTags = ContactTag::where('user_id', getParentUser()->id)
            ->whereIn('id', $request->contact_tags ?? [])
            ->with('contacts')
            ->get()
            ->flatMap(fn($contactTag) => $contactTag->contacts->where('is_blocked', Status::NO)->pluck('id'))
            ->toArray();

        $contactIds = array_unique(array_merge($contactIdsFromList, $contactIdsFromTags)) ?? [];

        if (empty($contactIds)) {
            return responseManager('contact_limit', 'At least one contact is required');
        }

        if ($request->schedule == 'on' && $request->scheduled_at) {
            $status = Status::CAMPAIGN_SCHEDULED;
            $timezone = $request->schedule_timezone ?? config('app.timezone');
            $sendAt = Carbon::parse($request->scheduled_at, $timezone)->setTimezone(config('app.timezone'));
        } else {
            $status = Status::CAMPAIGN_RUNNING;
            $sendAt = now();
        }

        $campaign = new Campaign();
        $campaign->title = $request->title;
        $campaign->user_id = $user->id;
        $campaign->whatsapp_account_id = $whatsappAccount->id;
        $campaign->template_id = $template->id;
        $campaign->template_header_params = $headerParams ?? [];
        $campaign->template_body_params = $bodyParams ?? [];
        $campaign->et = Status::NO;
        $campaign->status = $status;
        $campaign->analytics_version = Status::CAMPAIGN_ANALYTICS_V2;
        $campaign->send_at = $sendAt;
        $campaign->schedule_timezone = $request->schedule_timezone;
        $campaign->total_message = count($contactIds);
        $campaign->save();

        $campaign->contacts()->sync($contactIds);
        CampaignContact::where('campaign_id', $campaign->id)->update(['send_at' => $sendAt]);

        decrementFeature($user, 'campaign_limit');

        $notify[] = 'Campaign created successfully';
        return apiResponse('campaign_created', 'success', $notify);
    }

    public function report(Request $request, $id)
    {
        $user = getParentUser();
        $pageTitle = "Campaign Report";
        $campaign = Campaign::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $baseQuery = CampaignContact::where('campaign_id', $campaign->id)->with('contact');

        [$from, $to] = $this->parseFilterDateRange($request);
        if ((int) ($campaign->analytics_version ?? 1) >= Status::CAMPAIGN_ANALYTICS_V2) {
            if ($request->boolean('refresh_meta') || !$campaign->metaAnalyticsSnapshots()->exists()) {
                app(MetaCampaignAnalyticsService::class)->refreshForCampaign($campaign, $from, $to);
            }
        }

        $analytics = app(CampaignReportAnalyticsService::class)->getReport($campaign, [
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'tz' => $request->input('tz'),
        ]);

        $targeted = (int) ($analytics['summary']['targeted'] ?? $campaign->total_message);
        $widget['sending_ratio'] = $this->percentage((int) ($analytics['summary']['sent'] ?? 0), $targeted);
        $widget['success_ratio'] = $this->percentage((int) ($analytics['summary']['delivered'] ?? 0), $targeted);
        $widget['fail_ratio'] = $this->percentage((int) ($analytics['summary']['failed'] ?? 0), $targeted);

        if (request()->export) {
            if (request()->export == 'minimal') {
                return $this->downloadCsv($campaign, $baseQuery);
            }

            if (request()->export == 'maximal') {
                return exportData($baseQuery, 'excel', "campaignContact", "A4 landscape");
            }
        }

        $campaignContacts = $baseQuery->paginate(getPaginate());
        return view('Template::user.campaign.report', compact('pageTitle', 'campaign', 'widget', 'campaignContacts', 'analytics'));
    }

    public function reportAnalytics(Request $request, $id)
    {
        $user = getParentUser();
        $campaign = Campaign::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        [$from, $to] = $this->parseFilterDateRange($request);

        if (
            (int) ($campaign->analytics_version ?? 1) >= Status::CAMPAIGN_ANALYTICS_V2
            && ($request->boolean('refresh_meta') || !$campaign->metaAnalyticsSnapshots()->exists())
        ) {
            app(MetaCampaignAnalyticsService::class)->refreshForCampaign($campaign, $from, $to);
        }

        $analytics = app(CampaignReportAnalyticsService::class)->getReport($campaign, [
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'tz' => $request->input('tz'),
        ]);

        return response()->json([
            'status' => 'success',
            'campaign_id' => $campaign->id,
            'analytics' => $analytics,
        ]);
    }

    public function downloadCsv($campaign, $baseQuery = null)
    {
        $fileName = 'CampaignReport_' . $campaign->id . '.csv';
        $filePath = storage_path($fileName);
        $file = fopen($filePath, 'w');

        if ($file === false) {
            throw new Exception("Error opening the file");
        }

        $analytics = app(CampaignReportAnalyticsService::class)->getReport($campaign);
        $summary = $analytics['summary'] ?? [];
        $engagement = $analytics['engagement'] ?? [];

        fputcsv($file, [
            'Campaign ID',
            'Campaign Title',
            'Total message',
            'API accepted',
            'Delivered',
            'Read',
            'Failed',
            'Replied',
            'Clicks',
            'Delivery rate',
            'Opened rate',
            'Reply rate',
            'CTR',
        ]);

        fputcsv($file, [
            $campaign->id,
            $campaign->title,
            $summary['targeted'] ?? 0,
            $summary['api_accepted'] ?? 0,
            $summary['delivered'] ?? 0,
            $summary['read'] ?? 0,
            $summary['failed'] ?? 0,
            $engagement['replied'] ?? 0,
            $engagement['clicked'] ?? 0,
            $engagement['delivery_rate'] ?? 0,
            $engagement['opened_rate'] ?? 0,
            $engagement['reply_rate'] ?? 0,
            $engagement['ctr'] ?? 0,
        ]);

        fputcsv($file, []);
        fputcsv($file, [
            'Contact',
            'Status',
            'Delivery Status',
            'Sent At',
            'Delivered At',
            'Read At',
            'Failed At',
            'Replied At',
            'First Response Message ID',
            'Error Code',
            'Error Title',
            'Clicked',
            'Last Modified',
        ]);

        $contactsQuery = $baseQuery ? clone $baseQuery : CampaignContact::where('campaign_id', $campaign->id)->with('contact');
        $contacts = $contactsQuery->get();
        $clickedContactIds = LinkLog::where('campaign_id', $campaign->id)->pluck('contact_id')->flip();

        foreach ($contacts as $contact) {
            fputcsv($file, [
                @$contact->contact->mobileNumber,
                strip_tags($contact->statusBadge),
                $contact->delivery_status,
                $this->formatDateTimeForExport($contact->sent_at),
                $this->formatDateTimeForExport($contact->delivered_at),
                $this->formatDateTimeForExport($contact->read_at),
                $this->formatDateTimeForExport($contact->failed_at),
                $this->formatDateTimeForExport($contact->responded_at),
                $contact->first_response_message_id,
                $contact->meta_error_code,
                $contact->meta_error_title,
                $clickedContactIds->has($contact->contact_id) ? 'Yes' : 'No',
                $this->formatDateTimeForExport($contact->updated_at),
            ]);
        }

        fclose($file);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function clickTrack(Request $request)
    {
        $url = $request->url;

        if ($request->c && $request->u) {
            LinkLog::create([
                'campaign_id' => $request->c,
                'contact_id' => $request->u,
                'url' => $url,
                'ip_address' => getRealIP(),
                'user_agent' => $request->header('User-Agent'),
            ]);
        }

        return redirect()->to($url);
    }

    public function retarget($id, $status)
    {
        $user = getParentUser();
        $campaign = Campaign::where('user_id', $user->id)->findOrFail($id);
        $statusName = ucfirst(str_replace('_', ' ', $status));

        if ($status === 'clicked') {
            $contactIds = LinkLog::where('campaign_id', $campaign->id)
                ->distinct('contact_id')
                ->pluck('contact_id')
                ->toArray();
        } else {
            $query = CampaignContact::where('campaign_id', $campaign->id);
            $isValid = $this->applyRetargetFilter($query, $status);
            if (!$isValid) {
                $notify[] = ['error', 'Invalid retargeting status'];
                return back()->withNotify($notify);
            }
            $contactIds = $query->pluck('contact_id')->unique()->values()->toArray();
        }

        if (empty($contactIds)) {
            $notify[] = ['error', "No contacts found with status: $statusName"];
            return back()->withNotify($notify);
        }

        $listName = "Retarget: " . Str::limit($campaign->title, 20) . " ($statusName) - " . now()->format('d M, Y H:i');
        $listName = substr($listName, 0, 40);

        $contactList = new ContactList();
        $contactList->user_id = $user->id;
        $contactList->name = $listName;
        $contactList->save();

        $contactList->contact()->sync($contactIds);

        $notify[] = ['success', "Created list '$listName' with " . count($contactIds) . " contacts."];
        return redirect()->route('user.campaign.create')->withNotify($notify);
    }

    private function applyRetargetFilter($query, string $status): bool
    {
        if ($status === 'failed') {
            $query->where(function ($subQuery) {
                $subQuery->where('status', Status::CAMPAIGN_MESSAGE_IS_FAILED)
                    ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_FAILED);
            });
            return true;
        }

        if ($status === 'pending') {
            $query->where('status', Status::CAMPAIGN_MESSAGE_NOT_SENT);
            return true;
        }

        if ($status === 'success' || $status === 'delivered') {
            $query->where(function ($subQuery) {
                $subQuery->whereNotNull('delivered_at')
                    ->orWhereIn('delivery_status', [
                        Status::CAMPAIGN_DELIVERY_DELIVERED,
                        Status::CAMPAIGN_DELIVERY_READ,
                    ]);
            });
            return true;
        }

        if ($status === 'read') {
            $query->where(function ($subQuery) {
                $subQuery->whereNotNull('read_at')
                    ->orWhere('delivery_status', Status::CAMPAIGN_DELIVERY_READ);
            });
            return true;
        }

        if ($status === 'not_read') {
            $query->where(function ($subQuery) {
                $subQuery->whereNotNull('message_id')
                    ->whereNull('read_at')
                    ->where('delivery_status', '!=', Status::CAMPAIGN_DELIVERY_FAILED);
            });
            return true;
        }

        if ($status === 'replied') {
            $query->whereNotNull('responded_at');
            return true;
        }

        if ($status === 'not_replied') {
            $query->whereNotNull('message_id')->whereNull('responded_at');
            return true;
        }

        return false;
    }

    private function parseFilterDateRange(Request $request): array
    {
        $from = null;
        $to = null;
        $timezone = $request->input('tz') ?: config('app.timezone');

        if ($request->filled('from')) {
            try {
                $from = Carbon::parse($request->input('from'), $timezone)
                    ->startOfDay()
                    ->setTimezone(config('app.timezone'));
            } catch (Exception $e) {
                $from = null;
            }
        }

        if ($request->filled('to')) {
            try {
                $to = Carbon::parse($request->input('to'), $timezone)
                    ->endOfDay()
                    ->setTimezone(config('app.timezone'));
            } catch (Exception $e) {
                $to = null;
            }
        }

        return [$from, $to];
    }

    private function formatDateTimeForExport($value): string
    {
        if (!$value) {
            return '';
        }
        return Carbon::parse($value)->format('Y-m-d H:i:s');
    }

    private function percentage(int $value, int $total): float
    {
        if ($total <= 0) {
            return 0;
        }
        return ($value / $total) * 100;
    }
}
