import { motion } from "framer-motion";
import { SEO } from "@/components/seo";
import { GlassCard, NeonButton, GhostButton } from "@/components/glass-components";
import { Smartphone, Download, CheckCircle, ShieldCheck, QrCode, Cpu, Sparkles, ExternalLink } from "lucide-react";
import { SiGoogleplay, SiApple } from "react-icons/si";
import { useState } from "react";
import { PLAY_STORE_URL, ANDROID_APK_URL, IOS_PACKAGE_URL } from "@/lib/app-links";

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"googleplay" | "android" | "ios">("googleplay");

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
        description="Download the official Maternal Mind app for Android on Google Play Store, Direct APK, and iOS. Practice MCQs, read clinical topics, and track progress offline."
      />

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#11a4d4]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#11a4d4]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
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
            Get the official Maternal Mind app on your phone or tablet. Built specifically for OB-GYN residents and medical trainees for structured exam-focused preparation.
          </motion.p>
        </div>

        {/* Download Cards Grid - 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* 1. Google Play Store (Official Release - Featured) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="md:col-span-2 lg:col-span-1"
          >
            <GlassCard className="p-8 h-full flex flex-col justify-between border-[#11a4d4]/40 bg-gradient-to-b from-[#11a4d4]/10 to-transparent hover:border-[#11a4d4]/60 transition-all duration-300 relative group overflow-hidden shadow-lg shadow-[#11a4d4]/5">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <SiGoogleplay className="w-32 h-32 text-[#11a4d4]" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-[#3DDC84]/15 border border-[#3DDC84]/30 text-[#3DDC84]">
                    <SiGoogleplay className="w-8 h-8" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/30 text-xs text-[#3DDC84] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DDC84] animate-pulse" />
                    Official Release
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Google Play Store</h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  Official release on Google Play. Verified by Google Play Protect with 1-tap setup and automatic updates.
                </p>

                <div className="space-y-2.5 mb-8">
                  <div className="flex items-center gap-2 text-xs text-white/85">
                    <ShieldCheck className="w-4 h-4 text-[#3DDC84] shrink-0" /> Verified by Google Play Protect
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/85">
                    <CheckCircle className="w-4 h-4 text-[#11a4d4] shrink-0" /> Instant automatic cloud updates
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/85">
                    <Cpu className="w-4 h-4 text-[#11a4d4] shrink-0" /> Android 8.0+ Phones &amp; Tablets
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-block"
                  data-testid="button-download-googleplay"
                >
                  <NeonButton className="w-full justify-center py-3.5 text-base font-semibold gap-2.5">
                    <SiGoogleplay className="w-5 h-5 text-[#3DDC84]" />
                    Get it on Google Play
                    <ExternalLink className="w-4 h-4 opacity-70 ml-1" />
                  </NeonButton>
                </a>
              </div>
            </GlassCard>
          </motion.div>

          {/* 2. Android Direct APK */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <GlassCard className="p-8 h-full flex flex-col justify-between border-white/10 hover:border-white/30 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Smartphone className="w-32 h-32 text-white" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-white">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    APK v1.0.4 • 34.2 MB
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Android Direct APK</h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  Standalone APK installer for devices without Google Play Services, Huawei phones, or offline sideloading.
                </p>

                <div className="space-y-2.5 mb-8">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <ShieldCheck className="w-4 h-4 text-[#3DDC84] shrink-0" /> Verified Secure &amp; Signed
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Cpu className="w-4 h-4 text-[#11a4d4] shrink-0" /> Universal ARM64 &amp; x86_64
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <CheckCircle className="w-4 h-4 text-[#11a4d4] shrink-0" /> Full offline learning capability
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={ANDROID_APK_URL}
                  download="maternal-mind-v1.0.apk"
                  className="w-full inline-block"
                  data-testid="button-download-apk"
                >
                  <GhostButton className="w-full justify-center py-3.5 text-sm font-semibold gap-2 border-white/20 hover:border-white/40">
                    <Download className="w-4 h-4" />
                    Download Direct APK File
                  </GhostButton>
                </a>
              </div>
            </GlassCard>
          </motion.div>

          {/* 3. iOS Package */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <GlassCard className="p-8 h-full flex flex-col justify-between border-white/10 hover:border-white/30 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <SiApple className="w-32 h-32 text-white" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-white">
                    <SiApple className="w-8 h-8" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    iOS v1.0.4 • 38.5 MB
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">iOS &amp; iPadOS</h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  Direct iOS installer package for iPhone and iPad devices. Optimized for retina displays and split view.
                </p>

                <div className="space-y-2.5 mb-8">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <ShieldCheck className="w-4 h-4 text-[#11a4d4] shrink-0" /> Apple Developer Profile Signed
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <CheckCircle className="w-4 h-4 text-[#11a4d4] shrink-0" /> iPhone &amp; iPad HD Layouts
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Cpu className="w-4 h-4 text-[#11a4d4] shrink-0" /> Requires iOS / iPadOS 14.0+
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={IOS_PACKAGE_URL}
                  download="maternal-mind-v1.0.ipa"
                  className="w-full inline-block"
                  data-testid="button-download-ipa"
                >
                  <GhostButton className="w-full justify-center py-3.5 text-sm font-semibold gap-2 border-white/20 hover:border-white/40">
                    <Download className="w-4 h-4" />
                    Download iOS Package
                  </GhostButton>
                </a>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* QR Code Quick Scanner Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <GlassCard className="p-8 max-w-2xl mx-auto border-[#11a4d4]/20 flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-white p-3 rounded-2xl shrink-0 shadow-lg shadow-[#11a4d4]/10">
              <img
                src="/google-play-qr.png"
                alt="QR Code for Maternal Mind on Google Play"
                className="w-32 h-32 object-contain"
              />
            </div>
            <div className="text-center sm:text-left space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#11a4d4]/10 text-[#11a4d4] text-xs font-semibold">
                <QrCode className="w-3.5 h-3.5" /> Instant Scan &amp; Install
              </div>
              <h4 className="text-lg font-bold text-white">Scan from Your Mobile Phone</h4>
              <p className="text-sm text-white/70 leading-relaxed">
                Point your phone camera at this QR code to instantly open the official Maternal Mind listing on Google Play Store.
              </p>
              <div className="pt-1">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#11a4d4] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  play.google.com/store/apps/details?id=com.maternalmind.app
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </GlassCard>
        </motion.div>


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

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <button
                onClick={() => setActiveTab("googleplay")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "googleplay"
                    ? "bg-[#11a4d4] text-white shadow-lg shadow-[#11a4d4]/20"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                Google Play (Recommended)
              </button>
              <button
                onClick={() => setActiveTab("android")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "android"
                    ? "bg-[#11a4d4] text-white shadow-lg shadow-[#11a4d4]/20"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                Direct APK Sideload
              </button>
              <button
                onClick={() => setActiveTab("ios")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "ios"
                    ? "bg-[#11a4d4] text-white shadow-lg shadow-[#11a4d4]/20"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                iOS &amp; iPadOS Guide
              </button>
            </div>
          </div>

          <GlassCard className="p-8">
            {activeTab === "googleplay" ? (
              <ol className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">1</span>
                  <span>Click the <strong>Get it on Google Play</strong> button above or scan the QR code with your camera.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">2</span>
                  <span>On the Google Play Store page, tap <strong>Install</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">3</span>
                  <span>Google Play automatically installs the app with verified security through Google Play Protect.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">4</span>
                  <span>Open Maternal Mind, sign in or register, and begin your clinical OB-GYN study sessions!</span>
                </li>
              </ol>
            ) : activeTab === "android" ? (
              <ol className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">1</span>
                  <span>Click the <strong>Download Direct APK File</strong> button above to save <code>maternal-mind-v1.0.apk</code>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">2</span>
                  <span>Open your device downloads and tap on the downloaded APK file.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">3</span>
                  <span>If prompted, select <strong>Settings</strong> and enable <em>"Allow from this source"</em>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">4</span>
                  <span>Tap <strong>Install</strong> to complete setup and launch Maternal Mind.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">1</span>
                  <span>Click the <strong>Download iOS Package</strong> button above on your iPhone or iPad.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">2</span>
                  <span>Tap <strong>Install</strong> when the iOS installation confirmation appears.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">3</span>
                  <span>Go to iOS <strong>Settings &gt; General &gt; VPN &amp; Device Management</strong> and tap <em>Trust Developer Profile</em>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#11a4d4]/20 text-[#11a4d4] font-bold text-xs shrink-0">4</span>
                  <span>Open Maternal Mind from your home screen and enjoy full offline access!</span>
                </li>
              </ol>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
