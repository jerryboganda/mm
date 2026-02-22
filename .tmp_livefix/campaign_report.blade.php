@extends($activeTemplate . 'layouts.master')

@php
    $summary = $analytics['summary'] ?? [];
    $engagement = $analytics['engagement'] ?? [];
    $failures = $analytics['failures']['breakdown'] ?? collect();
    $timeline = $analytics['timeline']['daily'] ?? [];
    $metaEstimated = $analytics['meta_estimated'] ?? [];
@endphp

@section('content')
    <div class="dashboard-container">
        <div class="report-wrapper">
            <div class="d-flex align-items-center justify-content-end flex-wrap gap-2">
                <form class="select-group filter-form">
                    <select class="form-select form--control select2" data-minimum-results-for-search="-1" name="export">
                        <option selected value="">@lang('Export Report')</option>
                        <option value="minimal">@lang('Minimal')</option>
                        <option value="maximal">@lang('Maximal')</option>
                    </select>
                </form>

                <a href="{{ request()->fullUrlWithQuery(['refresh_meta' => 1]) }}" class="btn btn--dark btn--sm">
                    <i class="las la-sync-alt me-1"></i>@lang('Refresh Meta Snapshot')
                </a>

                <div class="dropdown">
                    <button class="btn btn--base dropdown-toggle" type="button" data-bs-toggle="dropdown"
                        aria-expanded="false">
                        @lang('Retargeting Actions')
                    </button>
                    <ul class="dropdown-menu">
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'failed']) }}">
                                <i class="las la-exclamation-circle me-2"></i> @lang('Create List from Failed')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'pending']) }}">
                                <i class="las la-clock me-2"></i> @lang('Create List from Pending')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'delivered']) }}">
                                <i class="las la-check-circle me-2"></i> @lang('Create List from Delivered')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'read']) }}">
                                <i class="las la-eye me-2"></i> @lang('Create List from Opened')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'not_read']) }}">
                                <i class="las la-eye-slash me-2"></i> @lang('Create List from Not Opened')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'replied']) }}">
                                <i class="las la-reply me-2"></i> @lang('Create List from Replied')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'not_replied']) }}">
                                <i class="las la-comment-slash me-2"></i> @lang('Create List from Not Replied')
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="{{ route('user.campaign.retarget', [$campaign->id, 'clicked']) }}">
                                <i class="las la-mouse-pointer me-2"></i> @lang('Create List from Clickers')
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            @if (($analytics['legacy_mode'] ?? false) === true)
                <div class="alert alert-warning mt-3 mb-0">
                    @lang('This campaign was sent before analytics v2 linkage. Deep metrics for old records may be partial. New campaigns are fully accurate.')
                </div>
            @endif

            @if (($summary['pending_delivery'] ?? 0) > 0)
                <div class="alert alert-info mt-3 mb-0">
                    @lang('Live updates are enabled for this report while delivery is still in progress.')
                </div>
            @endif

            <div class="report-top mt-4">
                <div class="row gy-4">
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Targeted')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text">{{ $summary['targeted'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('API Accepted')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--base">{{ $summary['api_accepted'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Delivered')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--success">{{ $summary['delivered'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">
                                @lang('Opened')
                                <span class="text--small text--muted d-block">@lang('Opened = Read receipt from WhatsApp')</span>
                            </h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--primary">{{ $summary['read'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Replied')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--primary">{{ $engagement['replied'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Clicked')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--primary">{{ $engagement['clicked'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Failed')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text text--danger">{{ $summary['failed'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xxl-3 col-sm-6">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Pending Delivery')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text">{{ $summary['pending_delivery'] ?? 0 }}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history"><h5 class="title">@lang('Delivery Funnel')</h5></div>
                <table class="table table--responsive--xl">
                    <thead>
                        <tr>
                            <th>@lang('Metric')</th>
                            <th>@lang('Count')</th>
                            <th>@lang('Rate')</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>@lang('Delivery Rate')</td>
                            <td>{{ $summary['delivered'] ?? 0 }}/{{ $summary['targeted'] ?? 0 }}</td>
                            <td>{{ getAmount($engagement['delivery_rate'] ?? 0) }}%</td>
                        </tr>
                        <tr>
                            <td>@lang('Opened Rate')</td>
                            <td>{{ $summary['read'] ?? 0 }}/{{ $summary['delivered'] ?? 0 }}</td>
                            <td>{{ getAmount($engagement['opened_rate'] ?? 0) }}%</td>
                        </tr>
                        <tr>
                            <td>@lang('Reply Rate')</td>
                            <td>{{ $engagement['replied'] ?? 0 }}/{{ $summary['delivered'] ?? 0 }}</td>
                            <td>{{ getAmount($engagement['reply_rate'] ?? 0) }}%</td>
                        </tr>
                        <tr>
                            <td>@lang('CTR')</td>
                            <td>{{ $engagement['clicked'] ?? 0 }}/{{ $summary['delivered'] ?? 0 }}</td>
                            <td>{{ getAmount($engagement['ctr'] ?? 0) }}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history"><h5 class="title">@lang('Reliability Metrics')</h5></div>
                <div class="row gy-3">
                    <div class="col-md-4">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Avg First Response')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text">{{ $engagement['avg_first_response_seconds'] ?? 0 }}s</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Avg Send to Deliver')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text">{{ $engagement['avg_send_to_deliver_seconds'] ?? 0 }}s</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="report-item">
                            <h5 class="report-item__title">@lang('Avg Deliver to Open')</h5>
                            <div class="report-item__bottom">
                                <div class="text-wrapper"><span class="text">{{ $engagement['avg_deliver_to_read_seconds'] ?? 0 }}s</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history"><h5 class="title">@lang('Failure Diagnostics')</h5></div>
                <table class="table table--responsive--xl">
                    <thead>
                        <tr>
                            <th>@lang('Error Code')</th>
                            <th>@lang('Error Title')</th>
                            <th>@lang('Count')</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($failures as $failure)
                            <tr>
                                <td>{{ $failure->error_code }}</td>
                                <td>{{ $failure->error_title }}</td>
                                <td>{{ $failure->total }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="3" class="text-center">@lang('No failure records found')</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history"><h5 class="title">@lang('Timeline')</h5></div>
                <table class="table table--responsive--xl">
                    <thead>
                        <tr>
                            <th>@lang('Date')</th>
                            <th>@lang('API Accepted')</th>
                            <th>@lang('Sent')</th>
                            <th>@lang('Delivered')</th>
                            <th>@lang('Opened')</th>
                            <th>@lang('Failed')</th>
                            <th>@lang('Replied')</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($timeline as $timelineRow)
                            <tr>
                                <td>{{ $timelineRow['event_date'] ?? '-' }}</td>
                                <td>{{ $timelineRow['api_accepted'] ?? 0 }}</td>
                                <td>{{ $timelineRow['sent'] ?? 0 }}</td>
                                <td>{{ $timelineRow['delivered'] ?? 0 }}</td>
                                <td>{{ $timelineRow['read'] ?? 0 }}</td>
                                <td>{{ $timelineRow['failed'] ?? 0 }}</td>
                                <td>{{ $timelineRow['replied'] ?? 0 }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center">@lang('No timeline events recorded yet')</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history"><h5 class="title">@lang('Estimated Attribution (Meta Aggregate)')</h5></div>
                <div class="row gy-3">
                    @forelse ($metaEstimated as $snapshot)
                        <div class="col-md-4">
                            <div class="report-item">
                                <h5 class="report-item__title text-capitalize">
                                    {{ str_replace('_', ' ', $snapshot['source_type'] ?? '') }}
                                </h5>
                                <div class="report-item__bottom">
                                    <div class="text-wrapper">
                                        <span class="text">
                                            @lang('Confidence'):
                                            <span class="badge badge--info text-capitalize">{{ $snapshot['attribution_confidence'] ?? 'low' }}</span>
                                        </span>
                                    </div>
                                    <small class="text--muted">
                                        @lang('Fetched at'): {{ !empty($snapshot['fetched_at']) ? showDateTime($snapshot['fetched_at']) : '-' }}
                                    </small>
                                </div>
                            </div>
                        </div>
                    @empty
                        <div class="col-12">
                            <div class="alert alert-info mb-0">
                                @lang('Meta aggregate analytics are not fetched yet. Click "Refresh Meta Snapshot" to pull latest estimated aggregates.')
                            </div>
                        </div>
                    @endforelse
                </div>
            </div>

            <div class="campaign-wrapper mt-4">
                <div class="performance-history">
                    <h5 class="title">@lang('Campaign History')</h5>
                </div>
                <table class="table table--responsive--xl">
                    <thead>
                        <tr>
                            <th>@lang('Contact')</th>
                            <th>@lang('Status')</th>
                            <th>@lang('Sent')</th>
                            <th>@lang('Delivered')</th>
                            <th>@lang('Opened')</th>
                            <th>@lang('Replied')</th>
                            <th>@lang('Last Modified')</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse (@$campaignContacts as $campaignContact)
                            <tr>
                                <td>
                                    {{ @$campaignContact->contact->mobileNumber }}
                                    @if ($campaignContact->meta_error_title)
                                        <div class="text--danger fs-12">{{ $campaignContact->meta_error_title }}</div>
                                    @endif
                                </td>
                                <td>@php echo $campaignContact->statusBadge; @endphp</td>
                                <td>{{ $campaignContact->sent_at ? showDateTime($campaignContact->sent_at) : '-' }}</td>
                                <td>{{ $campaignContact->delivered_at ? showDateTime($campaignContact->delivered_at) : '-' }}</td>
                                <td>{{ $campaignContact->read_at ? showDateTime($campaignContact->read_at) : '-' }}</td>
                                <td>{{ $campaignContact->responded_at ? showDateTime($campaignContact->responded_at) : '-' }}</td>
                                <td>{{ showDateTime($campaignContact->updated_at) }}<br>{{ diffForHumans($campaignContact->updated_at) }}</td>
                            </tr>
                        @empty
                            @include('Template::partials.empty_message')
                        @endforelse
                    </tbody>
                </table>
                {{ paginateLinks($campaignContacts) }}
            </div>
        </div>
    </div>
@endsection

@push('style-lib')
    <link rel="stylesheet" href="{{ asset('assets/global/css/select2.min.css') }}">
@endpush
@push('script-lib')
    <script src="{{ asset('assets/global/js/select2.min.js') }}"></script>
@endpush

@push('script')
    <script>
        (function($) {
            "use strict";

            $('.filter-form').find('select').on('change', function() {
                $('.filter-form').submit();
            });

            const pendingDelivery = Number(@json((int) ($summary['pending_delivery'] ?? 0)));
            if (pendingDelivery > 0) {
                setTimeout(function() {
                    window.location.reload();
                }, 30000);
            }
        })(jQuery);
    </script>
@endpush
