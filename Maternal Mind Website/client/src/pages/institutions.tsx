import { useState } from "react";
import { Link } from "wouter";
import {
  Building2, Users, BarChart3, Shield, ArrowRight,
  CheckCircle2, ClipboardList, UserPlus, Monitor,
  BookOpen, Award, Lock, Loader2
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";

const benefits = [
  {
    icon: Users,
    title: "Cohort Management",
    description: "Onboard entire training cohorts with streamlined group enrollment. Assign content tracks and monitor collective progress.",
  },
  {
    icon: BarChart3,
    title: "Admin Dashboard",
    description: "Track trainee engagement, completion rates, and performance metrics from a centralised administrator view.",
  },
  {
    icon: ClipboardList,
    title: "Curriculum Alignment",
    description: "Map platform content to your institution's training objectives and exam preparation requirements.",
  },
  {
    icon: Shield,
    title: "Data Privacy",
    description: "Enterprise-grade security with dedicated data handling. Compliant with institutional data governance policies.",
  },
  {
    icon: Award,
    title: "CPD Integration",
    description: "Support continuing professional development tracking with documented learning hours and assessment records.",
  },
  {
    icon: Monitor,
    title: "Instructor Tools",
    description: "Enable supervising consultants to assign specific topics, create custom quizzes, and review trainee performance.",
  },
];

export default function Institutions() {
  const [formData, setFormData] = useState({
    name: "",
    institution: "",
    role: "",
    email: "",
    cohortSize: "",
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
      const res = await fetch("/api/institutional-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Failed to submit request. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <SEO title="For Institutions" description="Bring structured OB-GYN education to your hospital or training programme. Cohort management, admin dashboards, and institutional access for Maternal Mind." path="/institutions" />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">For Institutions</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Empower Your
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">Training Programme</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Bring structured OB-GYN education to your hospital, residency programme, or medical institution with dedicated cohort management and institutional tools.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <SectionLabel className="mb-3 inline-block">Benefits</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">
                Built for Training Programmes
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <GlassCard className="p-6 glass-hover transition-all duration-300 h-full">
                  <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-4">
                    <b.icon className="w-5 h-5 text-[#11a4d4]" />
                  </div>
                  <h3 className="text-base font-medium text-white mb-2">{b.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{b.description}</p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <SectionLabel className="mb-3 inline-block">Get Started</SectionLabel>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Request Institutional Access
              </h2>
              <p className="text-sm text-white/60">
                Tell us about your institution and we will get back to you with a tailored proposal.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            {submitted ? (
              <GlassCard className="p-8 text-center" glow>
                <CheckCircle2 className="w-12 h-12 text-[#22c55e] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Request Received</h3>
                <p className="text-sm text-white/60">
                  Thank you for your interest. Our team will review your request and contact you within 2 business days.
                </p>
              </GlassCard>
            ) : (
              <GlassCard className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Your Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="Dr. Jane Smith"
                        required
                        data-testid="input-inst-name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Institution</label>
                      <input
                        type="text"
                        value={formData.institution}
                        onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="Hospital / University name"
                        required
                        data-testid="input-inst-institution"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Your Role</label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="Programme Director"
                        required
                        data-testid="input-inst-role"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                        placeholder="you@hospital.org"
                        required
                        data-testid="input-inst-email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Estimated Cohort Size</label>
                    <input
                      type="text"
                      value={formData.cohortSize}
                      onChange={(e) => setFormData({ ...formData, cohortSize: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors"
                      placeholder="e.g. 20-50 trainees"
                      data-testid="input-inst-cohort"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Message</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40 transition-colors resize-none"
                      placeholder="Tell us about your training programme and needs..."
                      data-testid="input-inst-message"
                    />
                  </div>
                  {error && (
                    <div className="p-3 rounded-md bg-[#ef4444]/10 border border-[#ef4444]/20 text-sm text-[#ef4444]" data-testid="text-inst-error">
                      {error}
                    </div>
                  )}
                  <NeonButton type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-inst-submit">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>Submit Request <ArrowRight className="w-4 h-4" /></>}
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
