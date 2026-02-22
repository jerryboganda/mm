import { Link } from "wouter";
import {
  BookOpen, Brain, BarChart3, User, CreditCard, Target,
  BookMarked, ArrowRight, Layers, Shuffle, RotateCcw,
  TrendingUp, Clock, Award, Download, Shield, Sparkles,
  CheckCircle2, Bookmark, FileText, Lock
} from "lucide-react";
import {
  GlassCard, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import { openAppDownload } from "@/lib/app-links";

const mainFeatures = [
  {
    icon: BookOpen,
    title: "Structured Learning Library",
    description: "Navigate an expertly organized OB-GYN knowledge base structured from Books to Chapters to Topics. Every piece of content is aligned to major exam syllabi including MRCOG and FCPS.",
    highlights: [
      "Books organized by specialty area",
      "Chapters with clear learning objectives",
      "Topic-level granularity for focused study",
      "Bookmark any topic for quick revisit",
    ],
  },
  {
    icon: Brain,
    title: "Intelligent MCQ Practice",
    description: "Multiple practice modes designed for different stages of your preparation. Topic-specific drilling, mixed question sets, and a dedicated wrong-questions mode to reinforce weak areas.",
    highlights: [
      "Topic-specific MCQ sets",
      "Mixed random question mode",
      "Wrong-questions review mode",
      "Detailed explanations with references",
    ],
  },
  {
    icon: BarChart3,
    title: "Progress Analytics Dashboard",
    description: "Understand your learning trajectory with detailed analytics. Track accuracy trends, study streaks, attempt history, and identify areas that need more attention.",
    highlights: [
      "Accuracy trends across topics",
      "Study streak tracking",
      "Attempt history with detailed review",
      "Weak area identification",
    ],
  },
];

const additionalFeatures = [
  { icon: Bookmark, title: "Smart Bookmarks", desc: "Save and organize topics for quick revision sessions." },
  { icon: Download, title: "Offline Access", desc: "Study without internet. Content available offline." },
  { icon: Clock, title: "Timed Practice", desc: "Simulate exam conditions with timed MCQ sessions." },
  { icon: RotateCcw, title: "Wrong Questions Mode", desc: "Automatically revisit questions you got wrong." },
  { icon: Shuffle, title: "Mixed Mode", desc: "Random questions across all topics for comprehensive review." },
  { icon: Shield, title: "Privacy & Security", desc: "Your data is encrypted and protected at all times." },
  { icon: FileText, title: "Cited References", desc: "Evidence-based explanations with source citations." },
  { icon: Lock, title: "Restore Purchases", desc: "Seamlessly restore subscriptions across devices." },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Features"
        description="Explore Maternal Mind's structured learning library, intelligent MCQ practice modes, progress analytics dashboard, and more features designed for OB-GYN postgraduate doctors."
        path="/features"
      />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Features</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Everything You Need for
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">OB-GYN Excellence</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Built specifically for postgraduate OB-GYN doctors, every feature is designed to support structured, exam-focused, evidence-based learning.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          {mainFeatures.map((feature, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <GlassCard className="p-8 glass-hover transition-all duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="w-12 h-12 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-[#11a4d4]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-3">{feature.title}</h2>
                    <p className="text-sm text-white/60 leading-relaxed mb-6">{feature.description}</p>
                    <ul className="space-y-3">
                      {feature.highlights.map((h, j) => (
                        <li key={j} className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                          <span className="text-sm text-white/70">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="glass rounded-md p-6">
                      <div className="space-y-3">
                        {feature.highlights.map((h, j) => (
                          <div key={j} className="flex items-center gap-3 p-3 bg-white/5 rounded-md">
                            <div className="w-8 h-8 rounded-md bg-[#11a4d4]/10 flex items-center justify-center shrink-0">
                              <Sparkles className="w-4 h-4 text-[#11a4d4]" />
                            </div>
                            <span className="text-sm text-white/70">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">More Features</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Designed for the Details
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {additionalFeatures.map((f, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <GlassCard className="p-5 glass-hover transition-all duration-300 h-full">
                  <f.icon className="w-5 h-5 text-[#11a4d4] mb-3" />
                  <h3 className="text-sm font-medium text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
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
                Start Your Journey Today
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Experience premium OB-GYN learning designed for postgraduate success.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <NeonButton size="lg" data-testid="button-features-cta" onClick={openAppDownload}>
                  Get the App <ArrowRight className="w-4 h-4" />
                </NeonButton>
                <Link href="/pricing">
                  <GhostButton size="lg">View Pricing</GhostButton>
                </Link>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
