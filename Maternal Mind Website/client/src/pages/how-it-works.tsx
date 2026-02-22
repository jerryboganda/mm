import { Link } from "wouter";
import {
  BookOpen, Brain, BarChart3, ArrowRight, ChevronRight,
  Layers, Target, TrendingUp, RotateCcw, CheckCircle2
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import { openAppDownload } from "@/lib/app-links";

const steps = [
  {
    number: "01",
    icon: BookOpen,
    title: "Choose Your Study Path",
    description: "Start by selecting from our structured library of OB-GYN content. Browse Books organized by specialty, then dive into Chapters and Topics.",
    details: [
      "Select from curated OB-GYN book collections",
      "Navigate chapters aligned to exam syllabi",
      "Read topic-level content with key learning points",
    ],
  },
  {
    number: "02",
    icon: Brain,
    title: "Practice with MCQs",
    description: "Test your understanding with exam-style questions. Choose from topic-specific, mixed, or wrong-questions mode for targeted revision.",
    details: [
      "Answer questions with immediate feedback",
      "Read detailed explanations with references",
      "Wrong-questions mode for focused improvement",
    ],
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Track Your Progress",
    description: "Monitor your performance with detailed analytics. See accuracy trends, identify weak areas, and maintain study streaks.",
    details: [
      "View accuracy trends across all topics",
      "Track your daily and weekly study streaks",
      "Identify topics that need more attention",
    ],
  },
  {
    number: "04",
    icon: RotateCcw,
    title: "Refine and Repeat",
    description: "Use your analytics insights to guide your next study session. Focus on weak areas, revisit bookmarked topics, and continuously improve.",
    details: [
      "Review attempt history for each question",
      "Revisit bookmarked topics for quick refreshers",
      "Progressively master all content areas",
    ],
  },
];

const contentStructure = [
  { label: "Books", desc: "Specialty areas like Obstetrics, Gynaecology", icon: Layers, count: "5+" },
  { label: "Chapters", desc: "Topic groups within each book", icon: BookOpen, count: "50+" },
  { label: "Topics", desc: "Individual learning units", icon: Target, count: "500+" },
  { label: "MCQs", desc: "Practice questions per topic", icon: Brain, count: "3000+" },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-void">
      <SEO title="How It Works" description="Learn how Maternal Mind's structured learning methodology works: study content, practice MCQs, track progress, and refine your OB-GYN knowledge." path="/how-it-works" />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">How It Works</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              A Clear Path to
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">Clinical Excellence</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Maternal Mind follows a proven learning methodology: study structured content, practice with questions, track your progress, and refine your knowledge.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Content Structure</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Hierarchical Knowledge Organisation
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {contentStructure.map((item, i) => (
                <div key={i} className="flex-1 flex items-stretch">
                  <GlassCard className="p-5 flex-1 glass-hover transition-all duration-300 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-3">
                      <item.icon className="w-5 h-5 text-[#11a4d4]" />
                    </div>
                    <p className="text-lg font-semibold text-[#11a4d4] mb-1">{item.count}</p>
                    <p className="text-sm font-medium text-white mb-1">{item.label}</p>
                    <p className="text-xs text-white/50">{item.desc}</p>
                  </GlassCard>
                  {i < contentStructure.length - 1 && (
                    <div className="hidden sm:flex items-center px-2">
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Step by Step</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                The Learning Loop
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {steps.map((step, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <GlassCard className="p-6 sm:p-8 glass-hover transition-all duration-300">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex items-start gap-4 shrink-0">
                      <span className="text-3xl font-light text-[#11a4d4]/30 font-mono">{step.number}</span>
                      <div className="w-12 h-12 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-[#11a4d4]" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed mb-4">{step.description}</p>
                      <ul className="space-y-2">
                        {step.details.map((d, j) => (
                          <li key={j} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                            <span className="text-sm text-white/70">{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.4}>
            <GlassPanel className="mt-8 p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-[#11a4d4]" />
                <p className="text-sm text-white/70">
                  <span className="text-white font-medium">Continuous improvement loop</span> — every session builds on the last.
                </p>
              </div>
              <Link href="/features">
                <GhostButton size="sm">
                  See All Features <ArrowRight className="w-4 h-4" />
                </GhostButton>
              </Link>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <GlassCard className="p-10" glow>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Start Learning in Minutes
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Download the app, create your account, and begin your structured OB-GYN learning journey today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <NeonButton size="lg" data-testid="button-hiw-cta" onClick={openAppDownload}>
                  Get the App <ArrowRight className="w-4 h-4" />
                </NeonButton>
                <Link href="/pricing">
                  <GhostButton size="lg">View Plans</GhostButton>
                </Link>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
