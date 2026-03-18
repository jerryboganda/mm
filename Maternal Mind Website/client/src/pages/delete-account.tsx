import { useState } from "react";
import {
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Shield,
  Smartphone,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  BackgroundOrbs,
  GlassCard,
  GlassPanel,
  GlowLink,
  GhostButton,
  NeonButton,
  ScrollReveal,
  SectionLabel,
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const summaryCards = [
  {
    icon: Trash2,
    title: "What gets deleted",
    desc: "Profile details, study progress, bookmarks, preferences, and personal data linked to your account.",
    sub: "Deletion applies to your Maternal Mind account data.",
  },
  {
    icon: Clock,
    title: "How long it takes",
    desc: "We process verified deletion requests within 30 days.",
    sub: "We may contact you first to confirm identity.",
  },
  {
    icon: Smartphone,
    title: "Subscriptions & billing",
    desc: "Deleting your account does not cancel App Store or Google Play billing.",
    sub: "Cancel the subscription in your store account first.",
  },
];

const faqs = [
  {
    q: "How long does account deletion take?",
    a: "Once we verify the request belongs to the account holder, we aim to complete deletion within 30 days. If we need more information to confirm identity, we will contact you first.",
  },
  {
    q: "What happens to my study progress and bookmarks?",
    a: "Your study progress, bookmarks, saved preferences, and personal data associated with the account are removed as part of the deletion request, except where limited retention is required by law or legitimate recordkeeping obligations.",
  },
  {
    q: "Will deleting my account cancel my subscription?",
    a: "No. Subscription cancellation must be handled separately through the App Store or Google Play account used for the purchase. Account deletion does not automatically stop store billing.",
  },
  {
    q: "Can I reverse a deletion request?",
    a: "If the request has not yet been completed, contact us as soon as possible. Once deletion has been carried out, the removed account data may not be recoverable.",
  },
];

type Platform = "android" | "ios" | "web" | "unknown";

export default function DeleteAccount() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    platform: "android" as Platform,
    message: "",
  });
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [confirmBilling, setConfirmBilling] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acknowledgementsAccepted = confirmDeletion && confirmBilling;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acknowledgementsAccepted) {
      setError(
        "Please confirm both acknowledgements before submitting your request.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/account-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          message: formData.message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || "Failed to submit deletion request.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Delete Account"
        description="Request deletion of your Maternal Mind account and associated data, including study progress, bookmarks, and saved preferences."
        path="/delete-account"
      />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <div className="mb-4">
              <GlowLink
                href="/legal"
                className="text-sm inline-flex items-center gap-1"
              >
                Legal <ChevronRight className="w-3 h-3" /> Delete Account
              </GlowLink>
            </div>
            <SectionLabel className="mb-4 inline-block">
              Account Deletion
            </SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Request Deletion of
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">
                Your Maternal Mind Account
              </span>
            </h1>
            <p className="text-base text-white/60 max-w-2xl mx-auto leading-relaxed">
              Use this page to request deletion of your Maternal Mind account
              and associated personal data. This public page is available for
              privacy requests and Google Play compliance.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {summaryCards.map((item) => (
                <GlassCard
                  key={item.title}
                  className="p-5 text-center glass-hover transition-all duration-300"
                >
                  <item.icon className="w-6 h-6 text-[#11a4d4] mx-auto mb-3" />
                  <h2 className="text-sm font-medium text-white mb-1">
                    {item.title}
                  </h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {item.desc}
                  </p>
                  <p className="text-xs text-white/40 mt-2">{item.sub}</p>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <GlassCard className="p-8">
              <div className="prose prose-invert prose-sm max-w-none space-y-6">
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Who can request deletion
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    The account holder can request deletion of their Maternal
                    Mind account by using the request form below or by emailing{" "}
                    <span className="text-[#11a4d4]">
                      privacy@maternalmind.app
                    </span>
                    .
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    What data is deleted
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Account deletion covers your profile details, study
                    progress, bookmarks, saved preferences, and associated
                    personal data linked to your Maternal Mind account.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    What may be retained
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    We may retain limited records where required by law, for
                    fraud prevention, billing reconciliation, dispute handling,
                    or other legitimate recordkeeping obligations.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Timeline and identity confirmation
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Verified requests are processed within 30 days. Before
                    deletion is completed, we may contact you to confirm that
                    the request was made by the account holder.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Subscriptions and billing
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    If you subscribed through Google Play or the App Store, you
                    must cancel that subscription separately in your store
                    account. Deleting your Maternal Mind account does not
                    automatically stop store billing.
                  </p>
                </section>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <ScrollReveal>
            {submitted ? (
              <GlassCard className="p-8 text-center" glow>
                <CheckCircle2 className="w-12 h-12 text-[#22c55e] mx-auto mb-4" />
                <h2 className="text-lg font-medium text-white mb-2">
                  Deletion Request Received
                </h2>
                <p className="text-sm text-white/60 leading-relaxed">
                  Your request has been submitted. Our team may contact you to
                  confirm identity before deletion is completed. Verified
                  requests are processed within 30 days.
                </p>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  If you have an active App Store or Google Play subscription,
                  remember to cancel it separately through your store account.
                </p>
              </GlassCard>
            ) : (
              <GlassCard className="p-6">
                <div className="mb-6">
                  <SectionLabel className="mb-3 inline-block">
                    Request Form
                  </SectionLabel>
                  <h2 className="text-2xl font-semibold text-white mb-3">
                    Submit a deletion request
                  </h2>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Complete the form below using the email address linked to
                    your Maternal Mind account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                        Full name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="Your full name"
                        required
                        data-testid="input-delete-account-name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                        Account email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="you@example.com"
                        required
                        data-testid="input-delete-account-email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                      Platform
                    </label>
                    <select
                      value={formData.platform}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          platform: e.target.value as Platform,
                        })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                      required
                      data-testid="select-delete-account-platform"
                    >
                      <option value="android" className="bg-[#101d22]">
                        Android
                      </option>
                      <option value="ios" className="bg-[#101d22]">
                        iOS
                      </option>
                      <option value="web" className="bg-[#101d22]">
                        Web
                      </option>
                      <option value="unknown" className="bg-[#101d22]">
                        Not sure
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows={5}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors resize-none"
                      placeholder="Optional details to help us locate your account or process the request."
                      data-testid="input-delete-account-message"
                    />
                  </div>

                  <GlassPanel className="p-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={confirmDeletion}
                        onCheckedChange={(checked) =>
                          setConfirmDeletion(checked === true)
                        }
                        className="mt-0.5 border-white/20 data-[state=checked]:bg-[#11a4d4] data-[state=checked]:border-[#11a4d4] text-white"
                        data-testid="checkbox-confirm-delete"
                      />
                      <span className="text-sm text-white/70 leading-relaxed">
                        I confirm that I want Maternal Mind to process this
                        account deletion request.
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={confirmBilling}
                        onCheckedChange={(checked) =>
                          setConfirmBilling(checked === true)
                        }
                        className="mt-0.5 border-white/20 data-[state=checked]:bg-[#11a4d4] data-[state=checked]:border-[#11a4d4] text-white"
                        data-testid="checkbox-confirm-billing"
                      />
                      <span className="text-sm text-white/70 leading-relaxed">
                        I understand that deleting my account does not cancel
                        App Store or Google Play billing, and I must cancel any
                        subscription separately.
                      </span>
                    </label>
                  </GlassPanel>

                  {error && (
                    <div
                      className="p-3 rounded-md bg-[#ef4444]/10 border border-[#ef4444]/20 text-sm text-[#ef4444]"
                      data-testid="text-delete-account-error"
                    >
                      {error}
                    </div>
                  )}

                  <NeonButton
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting || !acknowledgementsAccepted}
                    data-testid="button-delete-account-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Deletion Request
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </NeonButton>
                </form>
              </GlassCard>
            )}
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <div className="space-y-6">
              <GlassCard className="p-6">
                <SectionLabel className="mb-3 inline-block">
                  Direct Contact
                </SectionLabel>
                <h2 className="text-xl font-semibold text-white mb-3">
                  Prefer email instead?
                </h2>
                <p className="text-sm text-white/60 leading-relaxed mb-4">
                  You can request account deletion directly by contacting our
                  privacy team. Include the email address linked to your
                  account.
                </p>
                <div className="flex items-start gap-3 text-sm text-white/70 mb-5">
                  <Mail className="w-4 h-4 text-[#11a4d4] mt-0.5 shrink-0" />
                  <span>
                    privacy@maternalmind.app
                    <span className="block text-white/40 mt-1">
                      Support fallback: support@maternalmind.app
                    </span>
                  </span>
                </div>
                <GhostButton
                  className="w-full"
                  onClick={() =>
                    window.open(
                      "mailto:privacy@maternalmind.app?subject=Account%20Deletion%20Request",
                      "_self",
                    )
                  }
                  data-testid="button-delete-account-email"
                >
                  <Mail className="w-4 h-4" />
                  Email Privacy Team
                </GhostButton>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-[#11a4d4] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        Identity review
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed mt-1">
                        We may ask for limited details to confirm the request
                        belongs to the account holder before deletion is
                        completed.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#11a4d4] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        Limited retention
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed mt-1">
                        Some records may be retained where required by law,
                        fraud prevention, billing reconciliation, or dispute
                        resolution obligations.
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">FAQ</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Deletion Process Questions
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-2">
              <Accordion type="single" collapsible>
                {faqs.map((item, i) => (
                  <AccordionItem
                    key={item.q}
                    value={`delete-account-${i}`}
                    className="border-white/5"
                  >
                    <AccordionTrigger
                      className="px-4 py-4 text-sm text-white/90 hover:text-[#11a4d4] hover:no-underline"
                      data-testid={`accordion-delete-account-${i}`}
                    >
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm text-white/60 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
