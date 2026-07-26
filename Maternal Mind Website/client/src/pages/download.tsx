import { motion } from "framer-motion";
import { SEO } from "@/components/seo";
import { GlassCard, NeonButton, GhostButton } from "@/components/glass-components";
import { Smartphone, Apple, Download, CheckCircle, ShieldCheck, ArrowRight, QrCode, Cpu, Sparkles } from "lucide-react";
import { useState } from "react";

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  // Direct download file endpoints served by Express backend
  const ANDROID_APK_URL = "/downloads/maternal-mind-v1.0.apk";
  const IOS_FILE_URL = "/downloads/maternal-mind-v1.0.ipa";

  const features = [
    "Full offline access to 140+ MCQs & Study Topics",
    "Real-time sync with desktop & admin updates",
    "Instant push notifications for new practice questions",
    "Low battery & data consumption optimized",
  ];

  return (
    <div className="min-h-screen bg-[#0d161a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <SEO
        title="Download App — Maternal Mind OB-GYN Learning Platform"
        description="Download Maternal Mind for Android (APK) and iOS. Practice MCQs, read clinical topics, and track progress offline."
      />

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#11a4d4]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#11a4d4]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#11a4d4]/10 border border-[#11a4d4]/20 text-[#11a4d4] text-xs font-semibold uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Official Mobile Downloads
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent"
          >
            Study Anywhere with <span className="text-[#11a4d4]">Maternal Mind Mobile</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-white/70 leading-relaxed"
          >
            Download the official app directly to your phone. Designed for OB-GYN residents and medical students for fast offline learning.
          </motion.p>
        </div>

        {/* Download Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Android Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-8 h-full flex flex-col justify-between border-[#11a4d4]/20 hover:border-[#11a4d4]/40 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Smartphone className="w-32 h-32 text-[#11a4d4]" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-[#3DDC84]/10 border border-[#3DDC84]/20 text-[#3DDC84]">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    Android v1.0.4 • 34.2 MB
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Android Direct APK</h3>
                <p className="text-white/70 text-sm mb-6">
                  Direct APK installer compatible with Android 8.0 and above. Fast 1-click installation.
                </p>

                <div className="space-y-2 mb-8">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <ShieldCheck className="w-4 h-4 text-[#3DDC84]" /> Verified Secure & Malware-Free
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Cpu className="w-4 h-4 text-[#11a4d4]" /> Supports Arm64 & x86_64 devices
                  </div>
                </div>
              </div>

              <div>
                <a
                  href={ANDROID_APK_URL}
                  download="maternal-mind-v1.0.apk"
                  className="w-full inline-block"
                >
                  <NeonButton className="w-full justify-center py-3 text-base font-semibold gap-2">
                    <Download className="w-5 h-5" />
                    Download Android APK Directly
                  </NeonButton>
                </a>
              </div>
            </GlassCard>
          </motion.div>

          {/* iOS Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard className="p-8 h-full flex flex-col justify-between border-white/10 hover:border-white/30 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Apple className="w-32 h-32 text-white" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-white">
                    <Apple className="w-8 h-8" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    iOS / iPadOS v1.0.4 • 38.5 MB
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">iOS App Download</h3>
                <p className="text-white/70 text-sm mb-6">
                  Direct iOS build installer for iPhone and iPad devices (iOS 14.0+ required).
                </p>

                <div className="space-y-2 mb-8">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <ShieldCheck className="w-4 h-4 text-[#11a4d4]" /> Official Apple Developer Signed
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <CheckCircle className="w-4 h-4 text-[#11a4d4]" /> Supports iPhone & iPad HD layouts
                  </div>
                </div>
              </div>

              <div>
                <a
                  href={IOS_FILE_URL}
                  download="maternal-mind-v1.0.ipa"
                  className="w-full inline-block"
                >
                  <GhostButton className="w-full justify-center py-3 text-base font-semibold gap-2 border-white/20 hover:border-white/40">
                    <Download className="w-5 h-5" />
                    Download iOS Package Directly
                  </GhostButton>
                </a>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Feature Highlights Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <GlassCard className="p-8">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Why Use Maternal Mind Mobile?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <CheckCircle className="w-5 h-5 text-[#11a4d4] shrink-0 mt-0.5" />
                  <span className="text-sm text-white/80">{feat}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Installation Instructions Accordion / Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Installation Instructions</h3>
            <p className="text-sm text-white/60">Follow these simple steps after downloading your file</p>

            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setActiveTab("android")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "android"
                    ? "bg-[#11a4d4] text-white shadow-lg shadow-[#11a4d4]/20"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                Android Setup Guide
              </button>
              <button
                onClick={() => setActiveTab("ios")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "ios"
                    ? "bg-[#11a4d4] text-white shadow-lg shadow-[#11a4d4]/20"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                iOS Setup Guide
              </button>
            </div>
          </div>

          <GlassCard className="p-8">
            {activeTab === "android" ? (
              <ol className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">1</span>
                  <span>Click the <strong>Download Android APK Directly</strong> button above to save the file.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">2</span>
                  <span>Open your browser's downloads folder and tap on <code>maternal-mind-v1.0.apk</code>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">3</span>
                  <span>If prompted, tap <strong>Settings</strong> and enable <em>"Allow installation from this source"</em>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">4</span>
                  <span>Tap <strong>Install</strong> and open Maternal Mind to sign in!</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">1</span>
                  <span>Click the <strong>Download iOS Package Directly</strong> button above on your iPhone or iPad.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">2</span>
                  <span>Tap <strong>Install</strong> when the iOS installation prompt appears on your screen.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">3</span>
                  <span>Go to iOS <strong>Settings &gt; General &gt; VPN &amp; Device Management</strong> and tap <em>Trust Developer Profile</em>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">4</span>
                  <span>Open Maternal Mind from your home screen and start learning!</span>
                </li>
              </ol>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
