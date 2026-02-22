import { Link } from "wouter";
import {
  Target, Heart, Shield, BookOpen, Brain,
  ArrowRight, CheckCircle2, Globe, Lightbulb,
  GraduationCap, Sparkles, Clock
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import { openAppDownload } from "@/lib/app-links";

const values = [
  {
    icon: Target,
    title: "Clinical Precision",
    description: "Every piece of content is developed with accuracy as the highest priority, aligned to established guidelines and peer-reviewed evidence.",
  },
  {
    icon: Heart,
    title: "Trainee-Centric Design",
    description: "Built by understanding the real challenges of postgraduate training. Every feature addresses a genuine need in medical education.",
  },
  {
    icon: Shield,
    title: "Responsible Education",
    description: "We maintain clear boundaries between educational content and clinical practice, always emphasising the distinction in our messaging.",
  },
  {
    icon: Globe,
    title: "Global Accessibility",
    description: "Designed to serve OB-GYN professionals worldwide, from MRCOG candidates in the UK to FCPS trainees in Pakistan and beyond.",
  },
];

const roadmap = [
  { phase: "Foundation", status: "complete", items: ["Core content library", "MCQ practice engine", "Progress analytics", "Subscription system"] },
  { phase: "Enhancement", status: "active", items: ["Cited explanations", "Expanded MCQ bank", "Study streak features", "Performance insights"] },
  { phase: "Expansion", status: "upcoming", items: ["Institutional tools", "Instructor dashboards", "CPD tracking", "Community features"] },
  { phase: "Innovation", status: "future", items: ["AI-powered recommendations", "Adaptive learning paths", "Collaborative study", "Integrated resources"] },
];

export default function About() {
  return (
    <div className="min-h-screen bg-void">
      <SEO title="About" description="Learn about Maternal Mind's mission to advance OB-GYN education with clinical precision. Our values, audience, and product roadmap." path="/about" />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">About Us</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Advancing OB-GYN Education
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">with Purpose and Precision</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Maternal Mind exists to bridge the gap between clinical knowledge and exam readiness for OB-GYN professionals at every stage of their career.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <GlassCard className="p-8" glow>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-6 h-6 text-[#11a4d4]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-3">Our Mission</h2>
                  <p className="text-white/60 leading-relaxed mb-4">
                    To provide postgraduate OB-GYN doctors with the highest quality educational tools that combine structured learning, targeted practice, and intelligent progress tracking — enabling them to learn more effectively and prepare with confidence.
                  </p>
                  <p className="text-white/60 leading-relaxed">
                    We believe that medical education technology should be as precise and reliable as the clinical practice it supports. That is why every feature of Maternal Mind is built with the same rigour expected in evidence-based medicine.
                  </p>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Our Values</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                What Guides Us
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <GlassCard className="p-6 glass-hover transition-all duration-300 h-full">
                  <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-[#11a4d4]" />
                  </div>
                  <h3 className="text-base font-medium text-white mb-2">{v.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{v.description}</p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Who We Serve</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Built for Every Stage of Your Career
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "MRCOG Candidates", desc: "Parts 1, 2, and 3 preparation with structured content and exam-style MCQs aligned to the RCOG curriculum.", icon: GraduationCap },
              { title: "FCPS Trainees", desc: "OB-GYN trainees preparing for CPSP examinations with comprehensive topic coverage and drilling tools.", icon: BookOpen },
              { title: "Residents & Registrars", desc: "Rapid revision and knowledge reinforcement for busy training schedules with flexible study modes.", icon: Clock },
              { title: "Early Consultants", desc: "Continuous professional development and quick refreshers for consultants wanting to stay current.", icon: Sparkles },
            ].map((audience, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <GlassCard className="p-6 glass-hover transition-all duration-300 h-full">
                  <audience.icon className="w-5 h-5 text-[#11a4d4] mb-3" />
                  <h3 className="text-base font-medium text-white mb-2">{audience.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{audience.desc}</p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Roadmap</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Where We Are Headed
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {roadmap.map((phase, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <GlassCard className={`p-5 h-full ${phase.status === "active" ? "neon-border" : ""}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${
                      phase.status === "complete" ? "bg-[#22c55e]" :
                      phase.status === "active" ? "bg-[#11a4d4]" :
                      phase.status === "upcoming" ? "bg-[#eab308]" :
                      "bg-white/20"
                    }`} />
                    <span className="text-xs font-medium uppercase tracking-widest text-white/40">
                      {phase.phase}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3 h-3 shrink-0 ${
                          phase.status === "complete" ? "text-[#22c55e]" :
                          phase.status === "active" ? "text-[#11a4d4]" :
                          "text-white/20"
                        }`} />
                        <span className="text-xs text-white/60">{item}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <GlassCard className="p-10" glow>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Join the Journey
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Be part of a growing community of OB-GYN professionals committed to excellence in clinical education.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <NeonButton size="lg" data-testid="button-about-cta" onClick={openAppDownload}>
                  Get the App <ArrowRight className="w-4 h-4" />
                </NeonButton>
                <Link href="/support">
                  <GhostButton size="lg">Contact Us</GhostButton>
                </Link>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
