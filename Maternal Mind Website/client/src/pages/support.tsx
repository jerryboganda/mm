import { useState } from "react";
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield,
  Loader2,
  MessageSquare,
  Globe,
} from "lucide-react";
import {
  GlassCard,
  GlassPanel,
  NeonButton,
  SectionLabel,
  ScrollReveal,
  BackgroundOrbs,
  GlowLink,
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const troubleshooting = [
  {
    q: "I cannot sign in to my account",
    a: "Ensure you are using the correct email and password. If you have forgotten your password, use the 'Forgot Password' option on the sign-in screen. If the issue persists, contact us with the email associated with your account.",
  },
  {
    q: "My subscription is not showing as active",
    a: "Try using the 'Restore Purchases' option in your profile settings. If your subscription was purchased through the App Store or Google Play, make sure you are signed in with the same account. Allow a few minutes for the status to update.",
  },
  {
    q: "Content is not loading or displays errors",
    a: "Check your internet connection and try refreshing the app. If using offline mode, ensure the content was downloaded while connected. Clear the app cache in your device settings if the issue continues.",
  },
  {
    q: "How do I download content for offline use?",
    a: "Navigate to any topic or chapter and look for the download icon. Tap it to save content for offline reading. Downloaded content will be available even without an internet connection.",
  },
  {
    q: "I found an error in the content",
    a: "We take content accuracy very seriously. Please report any errors through this support form with the specific topic, question number, and a description of the issue. Our clinical review team will investigate promptly.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "You can cancel through your device's subscription management: on iOS go to Settings > Apple ID > Subscriptions, on Android go to Google Play > Subscriptions. Your access continues until the end of the billing period.",
  },
  {
    q: "How do I delete my account and associated data?",
    a: "Use our dedicated account deletion page to submit the request or contact the privacy team directly. The page explains timelines, retained records, and subscription cancellation steps.",
  },
];

export default function Support() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Failed to send message. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Support"
        description="Get help with Maternal Mind. Browse common questions, troubleshooting guides, and contact our support team directly."
        path="/support"
      />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Support</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              How Can We
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">
                Help You?
              </span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Our team is here to help you get the most from Maternal Mind.
              Browse common issues below or reach out directly.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              {[
                {
                  icon: Mail,
                  title: "Email Support",
                  desc: "maternalmind.help@gmail.com",
                  sub: "24/7 Email Help",
                  href: "mailto:maternalmind.help@gmail.com",
                },
                {
                  icon: MessageSquare,
                  title: "WhatsApp Helpline",
                  desc: "+923360830836",
                  sub: "Instant Chat Support",
                  href: "https://wa.me/923360830836",
                },
                {
                  icon: Globe,
                  title: "Official Website",
                  desc: "maternalmind.com.pk",
                  sub: "Online Portal & Portal Access",
                  href: "https://maternalmind.com.pk/",
                },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  className="block text-left"
                >
                  <GlassCard
                    className="p-5 text-center glass-hover transition-all duration-300 h-full"
                  >
                    <item.icon className="w-6 h-6 text-[#11a4d4] mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-white/70 font-mono">{item.desc}</p>
                    <p className="text-xs text-white/40 mt-1">{item.sub}</p>
                  </GlassCard>
                </a>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">
                Troubleshooting
              </SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Common Questions
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-2">
              <Accordion type="single" collapsible>
                {troubleshooting.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`ts-${i}`}
                    className="border-white/5"
                  >
                    <AccordionTrigger
                      className="px-4 py-4 text-sm text-white/90 hover:text-[#11a4d4] hover:no-underline"
                      data-testid={`accordion-ts-${i}`}
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

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal>
            <GlassPanel className="p-5 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <SectionLabel className="mb-2 inline-block">
                    Account Privacy
                  </SectionLabel>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Need to delete your Maternal Mind account and associated
                    data? Use our dedicated public request page.
                  </p>
                </div>
                <GlowLink
                  href="/delete-account"
                  className="text-sm font-medium whitespace-nowrap"
                >
                  Go to Delete Account
                </GlowLink>
              </div>
            </GlassPanel>
          </ScrollReveal>

          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">Contact</SectionLabel>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Send Us a Message
              </h2>
              <p className="text-sm text-white/60">
                Cannot find an answer? Contact us directly and we will respond
                within 24 hours.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            {submitted ? (
              <GlassCard className="p-8 text-center" glow>
                <CheckCircle2 className="w-12 h-12 text-[#22c55e] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Message Sent
                </h3>
                <p className="text-sm text-white/60">
                  Thank you for reaching out. We will get back to you within 24
                  hours.
                </p>
              </GlassCard>
            ) : (
              <GlassCard className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="Your name"
                        required
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                        Email
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
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                      placeholder="How can we help?"
                      required
                      data-testid="input-contact-subject"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows={5}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors resize-none"
                      placeholder="Describe your issue or question in detail..."
                      required
                      data-testid="input-contact-message"
                    />
                  </div>
                  {error && (
                    <div
                      className="p-3 rounded-md bg-[#ef4444]/10 border border-[#ef4444]/20 text-sm text-[#ef4444]"
                      data-testid="text-contact-error"
                    >
                      {error}
                    </div>
                  )}
                  <NeonButton
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                    data-testid="button-contact-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        Send Message <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </NeonButton>
                </form>
              </GlassCard>
            )}
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
