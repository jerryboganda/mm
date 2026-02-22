import { Link } from "wouter";
import {
  Download, Palette, FileImage, Stethoscope,
  Copy, CheckCircle2, ExternalLink
} from "lucide-react";
import { useState } from "react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";

const brandColors = [
  { name: "Primary Cyan", hex: "#11a4d4", desc: "Primary brand, glows, buttons" },
  { name: "Deep Teal", hex: "#0c7fa6", desc: "Hover states, borders" },
  { name: "Background Void", hex: "#101d22", desc: "Primary background" },
  { name: "Surface Dark", hex: "#152228", desc: "Card surfaces" },
  { name: "Success", hex: "#22c55e", desc: "Success states" },
  { name: "Warning", hex: "#eab308", desc: "Warning states" },
  { name: "Error", hex: "#ef4444", desc: "Error states" },
  { name: "Purple Accent", hex: "#a855f7", desc: "Secondary accent" },
];

export default function Media() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  return (
    <div className="min-h-screen bg-void">
      <SEO title="Media Kit" description="Maternal Mind press and brand resources. Download logos, brand colours, typography guides and media contact information." path="/media" />
      <BackgroundOrbs />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Media Kit</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Press & Brand
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">Resources</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Download brand assets, view our colour palette, and access guidelines for featuring Maternal Mind in press and media.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <GlassCard className="p-8 mb-8" glow>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-md bg-[#11a4d4]/20 border border-[#11a4d4]/30 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-8 h-8 text-[#11a4d4]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">Maternal Mind</h2>
                  <p className="text-sm text-white/60 leading-relaxed mb-4">
                    Maternal Mind is a premium mobile-first educational platform for postgraduate doctors in Obstetrics and Gynaecology. It provides structured learning content, exam-focused MCQs, and intelligent progress analytics for MRCOG, FCPS, and OB-GYN trainees worldwide.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60">Medical Education</span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60">OB-GYN</span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60">EdTech</span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60">Exam Preparation</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-6">
              <SectionLabel className="mb-3 inline-block">Brand Assets</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">Logo & Identity</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Logo - Dark Background", bg: "#101d22" },
                { label: "Logo - Light Background", bg: "#f0f4f5" },
                { label: "Logo Mark Only", bg: "#152228" },
              ].map((variant, i) => (
                <GlassCard key={i} className="overflow-hidden">
                  <div
                    className="h-32 flex items-center justify-center"
                    style={{ backgroundColor: variant.bg }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-[#11a4d4]/20 border border-[#11a4d4]/30 flex items-center justify-center">
                        <Stethoscope className="w-4 h-4 text-[#11a4d4]" />
                      </div>
                      {i < 2 && (
                        <span className={`text-base font-semibold tracking-tight ${i === 1 ? "text-[#101d22]" : "text-white"}`}>
                          Maternal Mind
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-white/60">{variant.label}</span>
                    <Download className="w-3.5 h-3.5 text-white/30" />
                  </div>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-6">
              <SectionLabel className="mb-3 inline-block">Colour Palette</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">Brand Colours</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {brandColors.map((color, i) => (
                <GlassCard
                  key={i}
                  className="overflow-hidden cursor-pointer glass-hover transition-all duration-300"
                  onClick={() => copyToClipboard(color.hex)}
                >
                  <div className="h-20 rounded-t-md" style={{ backgroundColor: color.hex }} />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-sm font-medium text-white">{color.name}</span>
                      {copiedColor === color.hex ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-white/30" />
                      )}
                    </div>
                    <p className="text-xs font-mono text-white/50">{color.hex}</p>
                    <p className="text-xs text-white/30 mt-1">{color.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-6">
              <SectionLabel className="mb-3 inline-block">Typography</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">Typeface</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Primary Font</h3>
                  <p className="text-3xl font-light text-white mb-2">Inter</p>
                  <p className="text-sm text-white/50 leading-relaxed">
                    Used for all headings, body text, and UI elements. Clean, legible, and professional at all sizes.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Type Scale</h3>
                  <div className="space-y-2">
                    <p className="text-2xl font-light text-white">H1 — 32px Light</p>
                    <p className="text-xl font-semibold text-white">H2 — 24px Semibold</p>
                    <p className="text-lg font-medium text-white">H3 — 20px Medium</p>
                    <p className="text-base text-white/80">Body — 16px Regular</p>
                    <p className="text-sm text-white/60">Caption — 14px</p>
                    <p className="text-xs font-medium uppercase tracking-widest text-white/40">Label — 12px Medium</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-6">
              <SectionLabel className="mb-3 inline-block">Guidelines</SectionLabel>
              <h2 className="text-2xl font-semibold text-white">Usage Guidelines</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-6">
              <div className="space-y-4">
                {[
                  "Use the full 'Maternal Mind' name in first reference; 'MM' abbreviation is acceptable in subsequent references.",
                  "Always maintain clear space around the logo equal to the height of the stethoscope icon.",
                  "The logo must appear on dark backgrounds (#101d22 or darker) or light backgrounds (#f0f4f5 or lighter).",
                  "Do not alter logo colours, proportions, or add effects not specified in these guidelines.",
                  "When describing Maternal Mind, use 'educational platform' — never 'medical advice tool' or similar.",
                  "For press inquiries, contact press@maternalmind.app.",
                ].map((guideline, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#11a4d4] shrink-0 mt-0.5" />
                    <span className="text-sm text-white/60 leading-relaxed">{guideline}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <GlassPanel className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-white">Press Contact</p>
                <p className="text-sm text-white/50">press@maternalmind.app</p>
              </div>
              <a href="mailto:press@maternalmind.app">
                <NeonButton size="sm" data-testid="button-press-contact">
                  Contact Press Team <ExternalLink className="w-4 h-4" />
                </NeonButton>
              </a>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
