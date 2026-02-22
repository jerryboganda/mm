import { useState, useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import {
  BookOpen, Brain, BarChart3, User, CreditCard,
  ChevronRight, Check, ArrowRight, Shield, Lock,
  FileText, BookMarked, Target, TrendingUp, Loader2,
  Zap, Clock, Award, Sparkles
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import { openAppDownload } from "@/lib/app-links";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const productTabs = [
  {
    id: "learn",
    label: "Learn",
    icon: BookOpen,
    title: "Structured Medical Content",
    description: "Navigate a carefully organized library of OB-GYN knowledge, structured from Books to Chapters to Topics for clear, systematic learning.",
    bullets: [
      "Evidence-based explanations aligned to exam syllabi",
      "Hierarchical content: Books, Chapters, Topics",
      "Bookmark and revisit key topics anytime",
    ],
    mockContent: (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 p-3 glass rounded-md">
          <BookMarked className="w-5 h-5 text-[#11a4d4] shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white/90">Obstetrics</p>
            <p className="text-xs text-white/40">24 Chapters</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </div>
        <div className="flex items-center gap-3 p-3 glass rounded-md">
          <BookMarked className="w-5 h-5 text-[#a855f7] shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white/90">Gynaecology</p>
            <p className="text-xs text-white/40">18 Chapters</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </div>
        <div className="flex items-center gap-3 p-3 glass rounded-md neon-border">
          <BookMarked className="w-5 h-5 text-[#22c55e] shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white/90">Reproductive Medicine</p>
            <p className="text-xs text-white/40">12 Chapters</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </div>
      </div>
    ),
  },
  {
    id: "practice",
    label: "Practice",
    icon: Brain,
    title: "Exam-Focused MCQ Drilling",
    description: "Test your knowledge with targeted MCQ modes designed for MRCOG and FCPS preparation. Learn from detailed explanations after every attempt.",
    bullets: [
      "Topic-specific, mixed, and wrong-questions modes",
      "Detailed explanations with cited references",
      "Track accuracy trends across attempts",
    ],
    mockContent: (
      <div className="space-y-3 p-4">
        <div className="glass rounded-md p-3">
          <p className="text-xs text-[#11a4d4] font-medium mb-2">Question 3 of 25</p>
          <p className="text-sm text-white/90 mb-3">A 28-year-old primigravida presents at 32 weeks gestation with proteinuria. Which investigation is most appropriate?</p>
          <div className="space-y-2">
            {["24-hour urine collection", "Spot protein/creatinine ratio", "Urine dipstick only", "Renal biopsy"].map((opt, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-md text-xs ${i === 1 ? "bg-[#11a4d4]/10 border border-[#11a4d4]/30 text-[#11a4d4]" : "bg-white/5 text-white/60"}`}>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${i === 1 ? "border-[#11a4d4]" : "border-white/20"}`}>
                  {i === 1 && <div className="w-2 h-2 rounded-full bg-[#11a4d4]" />}
                </div>
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    icon: BarChart3,
    title: "Intelligent Analytics",
    description: "Understand your strengths and weaknesses with detailed analytics. Track accuracy trends, study streaks, and identify areas needing attention.",
    bullets: [
      "Accuracy trends across topics and time",
      "Study streak tracking for consistent learning",
      "Weak area identification and focused review",
    ],
    mockContent: (
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-md p-3 text-center">
            <p className="text-xl font-semibold text-[#11a4d4]">78%</p>
            <p className="text-xs text-white/40">Overall Accuracy</p>
          </div>
          <div className="glass rounded-md p-3 text-center">
            <p className="text-xl font-semibold text-[#22c55e]">12</p>
            <p className="text-xs text-white/40">Day Streak</p>
          </div>
        </div>
        <div className="glass rounded-md p-3">
          <p className="text-xs text-white/40 mb-2">Weekly Progress</p>
          <div className="flex items-end gap-1 h-16">
            {[40, 55, 70, 45, 80, 65, 90].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-[#11a4d4]/30" style={{ height: `${h}%` }}>
                <div className="w-full rounded-sm bg-[#11a4d4]" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    title: "Your Learning Hub",
    description: "Manage your bookmarks, track subscription status, and review your learning history from a personalized profile dashboard.",
    bullets: [
      "Bookmarked topics for quick access",
      "Subscription management and status",
      "Attempt history with detailed reviews",
    ],
    mockContent: (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 p-3 glass rounded-md">
          <div className="w-10 h-10 rounded-full bg-[#11a4d4]/20 border border-[#11a4d4]/30 flex items-center justify-center">
            <User className="w-5 h-5 text-[#11a4d4]" />
          </div>
          <div>
            <p className="text-sm text-white/90 font-medium">Dr. Sarah Ahmed</p>
            <p className="text-xs text-[#22c55e]">Premium Active</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-md p-2 text-center">
            <p className="text-sm font-medium text-white/90">23</p>
            <p className="text-xs text-white/40">Bookmarks</p>
          </div>
          <div className="glass rounded-md p-2 text-center">
            <p className="text-sm font-medium text-white/90">156</p>
            <p className="text-xs text-white/40">MCQs Done</p>
          </div>
          <div className="glass rounded-md p-2 text-center">
            <p className="text-sm font-medium text-white/90">8h</p>
            <p className="text-xs text-white/40">Study Time</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "subscription",
    label: "Subscribe",
    icon: CreditCard,
    title: "Flexible Plans",
    description: "Choose the plan that fits your training schedule. Monthly, quarterly, or yearly options with full access to all learning tools.",
    bullets: [
      "Unlock all topics, MCQs, and analytics",
      "Offline access for studying anywhere",
      "Restore purchases across devices",
    ],
    mockContent: (
      <div className="space-y-3 p-4">
        <div className="glass rounded-md p-3 neon-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-white/90">Yearly Plan</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#11a4d4]/20 text-[#11a4d4]">Best Value</span>
          </div>
          <p className="text-2xl font-semibold text-[#11a4d4]">$49.99<span className="text-xs text-white/40 font-normal">/year</span></p>
          <p className="text-xs text-white/40 mt-1">Save 58% vs monthly</p>
        </div>
        <div className="space-y-2">
          {["All topics & MCQs", "Progress analytics", "Offline access"].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/60">
              <Check className="w-3 h-3 text-[#22c55e] shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const testimonials = [
  {
    name: "Dr. Aisha Khan",
    role: "MRCOG Part 2 Candidate",
    content: "The structured approach to learning has transformed my preparation. The MCQ practice mode with detailed explanations is exactly what I needed for my MRCOG Part 2.",
  },
  {
    name: "Dr. James Osei",
    role: "OB-GYN Registrar",
    content: "Maternal Mind fills a real gap in postgraduate medical education. The progress analytics help me identify weak areas quickly, and the content is clinically accurate.",
  },
  {
    name: "Dr. Fatima Raza",
    role: "FCPS Trainee, Obstetrics",
    content: "As an FCPS trainee, finding quality study material was always challenging. Maternal Mind provides everything in one place with a beautiful, distraction-free interface.",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("learn");
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWaitlistSubmitting(true);
    setWaitlistError(null);
    setWaitlistSuccess(false);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });

      if (!res.ok) {
        setWaitlistError("Failed to join waitlist. Please try again.");
        return;
      }

      setWaitlistSuccess(true);
      setWaitlistEmail("");
    } catch {
      setWaitlistError("Network error. Please check your connection and try again.");
    } finally {
      setIsWaitlistSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Premium OB-GYN Learning Platform"
        description="Structured content, exam-focused MCQs, and intelligent progress analytics for MRCOG, FCPS, and OB-GYN trainees. Built for postgraduate doctors."
        path="/"
      />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <SectionLabel className="mb-4 inline-block">Premium Medical Education</SectionLabel>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight leading-tight mb-6">
                Maternal Mind
                <span className="block text-[#11a4d4] neon-text-glow font-normal mt-2">
                  Premium OB-GYN Learning
                </span>
                <span className="block text-lg sm:text-xl font-normal text-white/70 mt-4 leading-relaxed tracking-normal">
                  for Postgraduate Doctors
                </span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-base text-white/60 mb-10 max-w-xl mx-auto leading-relaxed">
                Structured content, exam-focused MCQs, and intelligent progress analytics.
                Built for MRCOG, FCPS, and OB-GYN trainees who demand precision.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                <NeonButton size="lg" data-testid="button-hero-get-app" onClick={openAppDownload}>
                  Get the App
                  <ArrowRight className="w-4 h-4" />
                </NeonButton>
                <GhostButton
                  size="lg"
                  data-testid="button-hero-waitlist"
                  onClick={() => setShowWaitlistForm((current) => !current)}
                >
                  Join Waitlist
                </GhostButton>
                <Link href="/institutions">
                  <GhostButton size="lg" data-testid="button-hero-institutions">
                    Request Institutional Access
                  </GhostButton>
                </Link>
              </div>
              {showWaitlistForm && (
                <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto mb-6" data-testid="form-hero-waitlist">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40"
                      required
                      data-testid="input-hero-waitlist-email"
                    />
                    <NeonButton
                      type="submit"
                      size="lg"
                      disabled={isWaitlistSubmitting}
                      data-testid="button-hero-waitlist-submit"
                    >
                      {isWaitlistSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                    </NeonButton>
                  </div>
                  {waitlistError && (
                    <p className="mt-2 text-sm text-[#ef4444]" data-testid="text-hero-waitlist-error">
                      {waitlistError}
                    </p>
                  )}
                  {waitlistSuccess && (
                    <p className="mt-2 text-sm text-[#22c55e]" data-testid="text-hero-waitlist-success">
                      You are on the waitlist. We will be in touch soon.
                    </p>
                  )}
                </form>
              )}
              <Link href="/features" className="inline-flex items-center gap-1 text-sm text-[#11a4d4] hover:text-[#3dbde8] transition-colors" data-testid="link-explore-features">
                Explore Features <ChevronRight className="w-4 h-4" />
              </Link>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.4}>
            <GlassCard className="max-w-4xl mx-auto mt-16 p-1" glow>
              <div className="rounded-md bg-[#101d22]/80 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: BookOpen, label: "Structured Library", desc: "Books, chapters, topics" },
                    { icon: Brain, label: "Smart MCQs", desc: "Multiple practice modes" },
                    { icon: BarChart3, label: "Progress Analytics", desc: "Track your growth" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-[#11a4d4]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/90">{item.label}</p>
                        <p className="text-xs text-white/50">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Product Tour</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
                Everything You Need to Excel
              </h2>
              <p className="text-white/60 max-w-lg mx-auto">
                From structured learning to progress tracking, every feature is designed for clinical precision.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {productTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-[#11a4d4]/10 border border-[#11a4d4]/30 text-[#11a4d4]"
                      : "glass text-white/60 hover:text-white/80 hover:bg-white/5"
                  }`}
                  data-testid={`button-tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </ScrollReveal>

          {productTabs.map((tab) => (
            tab.id === activeTab && (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-medium text-white mb-3">{tab.title}</h3>
                    <p className="text-white/60 leading-relaxed">{tab.description}</p>
                  </div>
                  <ul className="space-y-3">
                    {tab.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-[#11a4d4]" />
                        </div>
                        <span className="text-sm text-white/70">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <GlassCard className="overflow-hidden">
                  <div className="bg-[#0d1b21] rounded-md p-1">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
                      <div className="w-2 h-2 rounded-full bg-[#ef4444]/60" />
                      <div className="w-2 h-2 rounded-full bg-[#eab308]/60" />
                      <div className="w-2 h-2 rounded-full bg-[#22c55e]/60" />
                      <span className="text-xs text-white/30 ml-2">Maternal Mind</span>
                    </div>
                    {tab.mockContent}
                  </div>
                </GlassCard>
              </motion.div>
            )
          ))}
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">By the Numbers</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white">
                Built for Serious Learners
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: 500, suffix: "+", label: "Topics Covered", icon: BookOpen },
                { value: 3000, suffix: "+", label: "Practice MCQs", icon: Brain },
                { value: 50, suffix: "+", label: "Study Hours Tracked", icon: Clock },
                { value: 98, suffix: "%", label: "Pass Rate Improvement", icon: Award },
              ].map((stat, i) => (
                <GlassCard key={i} className="p-6 text-center glass-hover transition-all duration-300">
                  <stat.icon className="w-6 h-6 text-[#11a4d4] mx-auto mb-3" />
                  <p className="text-2xl sm:text-3xl font-semibold text-white mb-1">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Trust & Responsibility</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
                Built with Clinical Rigour
              </h2>
              <p className="text-white/60 max-w-lg mx-auto">
                Every piece of content is developed with evidence-based methodology and reviewed for clinical accuracy.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  title: "Educational Use Only",
                  description: "Content is designed for exam preparation and continuous professional development. Not intended as clinical guidance.",
                },
                {
                  icon: Lock,
                  title: "Privacy First",
                  description: "Your learning data is encrypted and never shared. We follow strict data protection standards for your peace of mind.",
                },
                {
                  icon: FileText,
                  title: "Cited Explanations",
                  description: "Answers reference established guidelines and peer-reviewed sources, helping you build evidence-based clinical reasoning.",
                },
              ].map((item, i) => (
                <GlassCard key={i} className="p-6 glass-hover transition-all duration-300">
                  <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-[#11a4d4]" />
                  </div>
                  <h3 className="text-base font-medium text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <GlassPanel className="mt-8 p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#eab308] shrink-0 mt-0.5" />
              <p className="text-sm text-white/60 leading-relaxed">
                <span className="text-[#eab308] font-medium">Important:</span> Maternal Mind is an educational resource for postgraduate medical learning. It does not provide medical advice, diagnosis, or treatment recommendations. Always consult qualified healthcare professionals for clinical decisions.
              </p>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Testimonials</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white">
                Trusted by Medical Professionals
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.map((t, i) => (
                <GlassCard key={i} className="p-6 glass-hover transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-[#11a4d4]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{t.name}</p>
                      <p className="text-xs text-white/40">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed italic">"{t.content}"</p>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <GlassCard className="p-10" glow>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
                Ready to Elevate Your Learning?
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Join thousands of OB-GYN professionals who are advancing their careers with structured, exam-focused preparation.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <NeonButton size="lg" data-testid="button-cta-get-app" onClick={openAppDownload}>
                  Get the App
                  <ArrowRight className="w-4 h-4" />
                </NeonButton>
                <Link href="/pricing">
                  <GhostButton size="lg" data-testid="button-cta-pricing">
                    View Pricing
                  </GhostButton>
                </Link>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
