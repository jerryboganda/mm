import { useState } from "react";
import { Link } from "wouter";
import {
  Check, X, ArrowRight, HelpCircle, RotateCcw,
  ChevronDown, Shield
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const plans = [
  {
    name: "6 Months Plan",
    price: "700 PKR",
    period: "/6 months",
    description: "Full access to all topics & MCQs for 6 months",
    features: {
      "Full topic library": true,
      "All MCQ practice modes": true,
      "Progress analytics": true,
      "Bookmarks & notes": true,
      "Wrong-questions mode": true,
      "Offline access": true,
      "Priority support": true,
      "Early access to new content": false,
    },
    popular: false,
  },
  {
    name: "1 Year Plan",
    price: "1000 PKR",
    period: "/year",
    description: "Best value for complete OB-GYN exam preparation",
    badge: "Best Value",
    features: {
      "Full topic library": true,
      "All MCQ practice modes": true,
      "Progress analytics": true,
      "Bookmarks & notes": true,
      "Wrong-questions mode": true,
      "Offline access": true,
      "Priority support": true,
      "Early access to new content": true,
    },
    popular: true,
  },
];

const faqs = [
  {
    q: "Can I switch between plans?",
    a: "Yes, you can upgrade or renew your plan at any time through your profile or subscription settings.",
  },
  {
    q: "Is there a free trial?",
    a: "We offer a selection of free topics and MCQs so you can experience the platform before subscribing. Create an account to explore free content.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "You can cancel your subscription at any time through the app's subscription management section. Your access will continue until the end of your current billing period.",
  },
  {
    q: "Can I restore purchases on a new device?",
    a: "Yes. Simply sign in with your account on any device and use the 'Restore Purchases' option to re-activate your subscription.",
  },
  {
    q: "Do you offer institutional pricing?",
    a: "Yes, we offer special pricing for hospitals, training programs, and medical institutions. Contact us through our Institutions page to discuss volume licensing.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept local bank transfers, JazzCash, EasyPaisa, and major cards with quick admin verification.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-void">
      <SEO title="Pricing" description="Simple, transparent pricing plans for Maternal Mind: 6 Months (700 PKR) and 1 Year (1000 PKR) with full access to structured OB-GYN content and MCQ practice." path="/pricing" />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Pricing</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Simple, Transparent
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">Pricing Plans</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Choose the plan that fits your training schedule. All plans include full access to our structured learning library and practice tools.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {plans.map((plan, i) => (
                <GlassCard
                  key={i}
                  className={`p-6 relative transition-all duration-300 ${
                    plan.popular ? "neon-border neon-glow" : "glass-hover"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full bg-[#11a4d4] text-white" data-testid="badge-best-value">
                      {plan.badge}
                    </span>
                  )}

                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-lg font-medium text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-white/50 mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-semibold text-white">{plan.price}</span>
                      <span className="text-sm text-white/40">{plan.period}</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {Object.entries(plan.features).map(([feature, included]) => (
                      <div key={feature} className="flex items-center gap-3">
                        {included ? (
                          <Check className="w-4 h-4 text-[#22c55e] shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-white/20 shrink-0" />
                        )}
                        <span className={`text-sm ${included ? "text-white/70" : "text-white/30"}`}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {plan.popular ? (
                    <NeonButton className="w-full" data-testid={`button-plan-${plan.name.toLowerCase()}`}>
                      Get Started
                    </NeonButton>
                  ) : (
                    <GhostButton className="w-full" data-testid={`button-plan-${plan.name.toLowerCase()}`}>
                      Get Started
                    </GhostButton>
                  )}
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="flex items-center justify-center gap-2 mt-6">
              <RotateCcw className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/40">
                Already subscribed? <button className="text-[#11a4d4] hover:text-[#3dbde8] transition-colors" data-testid="button-restore-purchases">Restore purchases</button>
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">Payment Options</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Official Payment Accounts
              </h2>
              <p className="text-sm text-white/60 mt-2">
                Transfer subscription payment directly to any of our official accounts below:
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#11a4d4]/10 border border-[#11a4d4]/30 flex items-center justify-center text-[#11a4d4] font-bold text-sm">
                    HBL
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">HBL Bank Transfer</h3>
                    <p className="text-xs text-white/50">Habib Bank Limited</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-white/70">
                  <div className="flex justify-between">
                    <span className="text-white/40">Account Title:</span>
                    <span className="text-white font-medium">Farzana Muneer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Account Number:</span>
                    <span className="font-mono text-white select-all">08477902077901</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">IBAN:</span>
                    <span className="font-mono text-[#11a4d4] select-all">PK85HABB0008477902077901</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Branch:</span>
                    <span className="text-white/80">Chowk Azam Layyah</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e] font-bold text-sm">
                    JC
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">JazzCash Mobile Wallet</h3>
                    <p className="text-xs text-white/50">Mobile Wallet & Bank Transfer</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-white/70">
                  <div className="flex justify-between">
                    <span className="text-white/40">Account Title:</span>
                    <span className="text-white font-medium">Farzana Muneer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Account Number:</span>
                    <span className="font-mono text-white select-all">03360830836</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">IBAN:</span>
                    <span className="font-mono text-[#22c55e] select-all">PK77JCMA3101923360830836</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Bank:</span>
                    <span className="text-white/80">JazzCash</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="text-base font-semibold text-white mb-2">
                📸 How to Send Payment Proof
              </h3>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                After completing your payment transfer, send your receipt screenshot through any of the following channels:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <a
                  href="https://wa.me/923360830836?text=Hi%2C%20I%20have%20transferred%20payment%20for%20Maternal%20Mind%20subscription.%20Here%20is%20my%20receipt."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center font-bold shrink-0">
                    WA
                  </div>
                  <div>
                    <span className="block text-white font-medium group-hover:text-[#25D366]">Send via WhatsApp</span>
                    <span className="text-white/50 font-mono">+923360830836</span>
                  </div>
                </a>

                <a
                  href="mailto:maternalmind.help@gmail.com?subject=Payment%20Proof%20-%20Maternal%20Mind%20Subscription"
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#11a4d4]/10 border border-[#11a4d4]/30 hover:bg-[#11a4d4]/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#11a4d4] text-white flex items-center justify-center font-bold shrink-0">
                    @
                  </div>
                  <div>
                    <span className="block text-white font-medium group-hover:text-[#11a4d4]">Send via Email</span>
                    <span className="text-white/50 font-mono">maternalmind.help@gmail.com</span>
                  </div>
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">FAQ</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Frequently Asked Questions
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-2">
              <Accordion type="single" collapsible>
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-white/5">
                    <AccordionTrigger className="px-4 py-4 text-sm text-white/90 hover:text-[#11a4d4] hover:no-underline" data-testid={`accordion-faq-${i}`}>
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm text-white/60 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <GlassPanel className="p-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#11a4d4] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white/70 leading-relaxed">
                  <span className="text-white font-medium">Cancellation policy:</span> Cancel your subscription at any time. You will retain access to all features until the end of your current billing period. No cancellation fees.
                </p>
              </div>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
