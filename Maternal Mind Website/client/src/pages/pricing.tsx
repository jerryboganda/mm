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
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    description: "Flexible month-to-month access",
    features: {
      "Full topic library": true,
      "All MCQ modes": true,
      "Progress analytics": true,
      "Bookmarks": true,
      "Wrong-questions mode": true,
      "Offline access": true,
      "Priority support": false,
      "Early access to new content": false,
    },
    popular: false,
  },
  {
    name: "Quarterly",
    price: "$19.99",
    period: "/3 months",
    description: "Save 33% with quarterly billing",
    features: {
      "Full topic library": true,
      "All MCQ modes": true,
      "Progress analytics": true,
      "Bookmarks": true,
      "Wrong-questions mode": true,
      "Offline access": true,
      "Priority support": true,
      "Early access to new content": false,
    },
    popular: false,
  },
  {
    name: "Yearly",
    price: "$49.99",
    period: "/year",
    description: "Best value for serious preparation",
    badge: "Best Value",
    features: {
      "Full topic library": true,
      "All MCQ modes": true,
      "Progress analytics": true,
      "Bookmarks": true,
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
    a: "Yes, you can upgrade or downgrade your plan at any time. If upgrading, the price difference is prorated. If downgrading, the change takes effect at the end of your current billing period.",
  },
  {
    q: "Is there a free trial?",
    a: "We offer a selection of free topics and MCQs so you can experience the platform before subscribing. Create an account to explore the free content.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "You can cancel your subscription at any time through the app's subscription management section. Your access will continue until the end of the current billing period. No questions asked.",
  },
  {
    q: "Can I restore purchases on a new device?",
    a: "Yes. Simply sign in with your account on any device and use the 'Restore Purchases' option to re-activate your subscription. Works across iOS and Android.",
  },
  {
    q: "Do you offer institutional pricing?",
    a: "Yes, we offer special pricing for hospitals, training programs, and medical institutions. Contact us through our Institutions page to discuss volume licensing and cohort management.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, Apple Pay, and Google Pay through secure in-app purchase systems on iOS and Android.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-void">
      <SEO title="Pricing" description="Simple, transparent pricing plans for Maternal Mind. Monthly, quarterly, and yearly options with full access to structured OB-GYN content and MCQ practice." path="/pricing" />
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
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
