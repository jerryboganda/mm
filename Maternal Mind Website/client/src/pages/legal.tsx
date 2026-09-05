import { Link } from "wouter";
import {
  FileText,
  Shield,
  AlertTriangle,
  ChevronRight,
  UserRoundX,
} from "lucide-react";
import {
  GlassCard,
  GlowLink,
  SectionLabel,
  ScrollReveal,
  BackgroundOrbs,
} from "@/components/glass-components";
import { SEO } from "@/components/seo";

const legalPages = [
  {
    slug: "terms",
    icon: FileText,
    title: "Terms of Service",
    updated: "January 2026",
    description: "Terms governing your use of the Maternal Mind platform.",
  },
  {
    slug: "privacy",
    icon: Shield,
    title: "Privacy Policy",
    updated: "January 2026",
    description: "How we collect, use, and protect your personal data.",
  },
  {
    slug: "disclaimer",
    icon: AlertTriangle,
    title: "Medical Disclaimer",
    updated: "January 2026",
    description:
      "Important information about the educational nature of our content.",
  },
  {
    slug: "/delete-account",
    icon: UserRoundX,
    title: "Delete Account",
    updated: "March 2026",
    description:
      "Request deletion of your account and associated personal data.",
  },
];

export default function LegalHub() {
  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Legal"
        description="Maternal Mind legal documentation including Terms of Service, Privacy Policy, and Medical Disclaimer."
        path="/legal"
      />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Legal</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Legal Information
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Transparency and responsibility are core to Maternal Mind. Review
              our legal documentation below.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {legalPages.map((page, i) => (
            <ScrollReveal key={i} delay={i * 0.05}>
              <Link
                href={
                  page.slug.startsWith("/") ? page.slug : `/legal/${page.slug}`
                }
              >
                <GlassCard className="p-6 glass-hover transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0">
                      <page.icon className="w-5 h-5 text-[#11a4d4]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-white">
                        {page.title}
                      </h3>
                      <p className="text-sm text-white/50">
                        {page.description}
                      </p>
                      <p className="text-xs text-white/30 mt-1">
                        Last updated: {page.updated}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
                  </div>
                </GlassCard>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Terms of Service"
        description="Maternal Mind Terms of Service. Review the terms and conditions governing your use of the Maternal Mind platform."
        path="/legal/terms"
      />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="mb-4">
              <GlowLink
                href="/legal"
                className="text-sm flex items-center gap-1"
              >
                Legal <ChevronRight className="w-3 h-3" /> Terms of Service
              </GlowLink>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight mb-2">
              Terms of Service
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Last updated: January 2026
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-8">
              <div className="prose prose-invert prose-sm max-w-none space-y-6">
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    1. Acceptance of Terms
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    By accessing or using Maternal Mind (&quot;the
                    Platform&quot;), you agree to be bound by these Terms of
                    Service. If you do not agree to these terms, you should not
                    use the Platform. These terms apply to all users, including
                    trainees, consultants, and institutional administrators.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    2. Description of Service
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Maternal Mind is an educational platform providing
                    structured learning content, practice questions (MCQs), and
                    progress analytics for postgraduate doctors in Obstetrics
                    and Gynaecology. The Platform is designed for educational
                    purposes and exam preparation only.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    3. User Accounts
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    You are responsible for maintaining the confidentiality of
                    your account credentials. You must provide accurate
                    information during registration and keep your account
                    information up to date. You may not share your account with
                    others or use another person&apos;s account.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    4. Subscriptions and Payments
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Certain features require a paid subscription. Subscriptions
                    are processed through the App Store (iOS) or Google Play
                    (Android). Billing occurs at the start of each subscription
                    period. You may cancel at any time; access continues until
                    the end of the current billing period.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    5. Intellectual Property
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    All content on the Platform, including text, questions,
                    explanations, graphics, and software, is the property of
                    Maternal Mind or its licensors and is protected by
                    intellectual property laws. You may not reproduce,
                    distribute, or create derivative works without express
                    written permission.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    6. Acceptable Use
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    You agree to use the Platform only for lawful educational
                    purposes. You may not attempt to reverse engineer the
                    software, scrape content, distribute questions or
                    explanations, or use the Platform in any way that could harm
                    its operation or other users.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    7. Limitation of Liability
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Maternal Mind provides educational content on an &quot;as
                    is&quot; basis. We do not guarantee exam success or specific
                    outcomes. To the maximum extent permitted by law, we shall
                    not be liable for any indirect, incidental, or consequential
                    damages arising from your use of the Platform.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    8. Changes to Terms
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    We may update these terms from time to time. Continued use
                    of the Platform after changes constitutes acceptance of the
                    revised terms. We will notify users of significant changes
                    through the app or via email.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    9. Contact
                  </h2>
                  <p className="text-white/60 leading-relaxed mb-2">
                    For questions about these Terms, contact us:
                  </p>
                  <div className="text-sm text-white/70 space-y-1">
                    <p>• WhatsApp: <a href="https://wa.me/923360830836" target="_blank" rel="noreferrer" className="text-[#11a4d4]">+923360830836</a></p>
                    <p>• Web: <a href="https://maternalmind.com.pk/" target="_blank" rel="noreferrer" className="text-[#11a4d4]">https://maternalmind.com.pk/</a></p>
                    <p>• Email: <a href="mailto:maternalmind.help@gmail.com" className="text-[#11a4d4]">maternalmind.help@gmail.com</a></p>
                    <p>• For Book Delivery: <a href="https://wa.me/923212066562" target="_blank" rel="noreferrer" className="text-[#11a4d4]">+923212066562</a></p>
                  </div>
                </section>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Privacy Policy"
        description="Maternal Mind Privacy Policy. Learn how we collect, use, and protect your data when using our OB-GYN education platform."
        path="/legal/privacy"
      />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="mb-4">
              <GlowLink
                href="/legal"
                className="text-sm flex items-center gap-1"
              >
                Legal <ChevronRight className="w-3 h-3" /> Privacy Policy
              </GlowLink>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Last updated: January 2026
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-8">
              <div className="prose prose-invert prose-sm max-w-none space-y-6">
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    1. Information We Collect
                  </h2>
                  <p className="text-white/60 leading-relaxed mb-3">
                    Maternal Mind is an educational platform dedicated to Obstetrics and Gynaecology. We collect only the information necessary to provide, personalize, and secure your learning experience:
                  </p>
                  <ul className="list-disc pl-5 text-white/60 space-y-2">
                    <li>
                      <strong className="text-white">Account Information:</strong> Name, email address, password hash, and optional profile picture.
                    </li>
                    <li>
                      <strong className="text-white">Educational & Usage Data:</strong> Topics viewed, study progress, quiz scores, accuracy statistics, bookmarks, and personal clinical study notes.
                    </li>
                    <li>
                      <strong className="text-white">Device & Session Data:</strong> Device model, operating system version, authorized session identifiers, and IP addresses to prevent unauthorized multi-device sharing and safeguard account security.
                    </li>
                    <li>
                      <strong className="text-white">Payment & Subscription Data:</strong> Subscription tier (6 Months Plan or 1 Year Plan), renewal dates, and payment receipts. Note that in-app purchases on iOS are processed directly by Apple StoreKit; we never store your credit card or sensitive banking details.
                    </li>
                  </ul>
                  <p className="text-white/60 leading-relaxed mt-3">
                    We do not collect clinical patient data or medical health records.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    2. How We Use Your Information
                  </h2>
                  <p className="text-white/60 leading-relaxed mb-3">
                    We process your information for the following legitimate purposes:
                  </p>
                  <ul className="list-disc pl-5 text-white/60 space-y-1">
                    <li>Delivering curriculum topics, questions, and revision algorithms.</li>
                    <li>Syncing your study history and mock exam scores across authorized devices.</li>
                    <li>Managing active subscriptions and processing verification requests.</li>
                    <li>Providing prompt technical and academic support.</li>
                    <li>Protecting against fraud, account compromise, and unauthorized access.</li>
                  </ul>
                  <p className="text-white/60 leading-relaxed mt-3">
                    We <strong className="text-white">never sell, rent, or trade</strong> your personal information to third-party marketers or advertisers.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    3. Data Security & Storage
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    We implement industry-standard administrative, technical, and physical safeguards to protect your personal data. All communications are encrypted using Transport Layer Security (TLS 1.3 / HTTPS), and sensitive authentication credentials are encrypted and securely hashed.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    4. Account & Data Deletion
                  </h2>
                  <p className="text-white/60 leading-relaxed mb-3">
                    You have full control over your data. In full compliance with Apple and international privacy standards, you may permanently delete your account and all associated personal data at any time:
                  </p>
                  <ul className="list-disc pl-5 text-white/60 space-y-1">
                    <li>
                      <strong className="text-white">In-App:</strong> Go to Profile &gt; Account Settings &gt; Delete Account.
                    </li>
                    <li>
                      <strong className="text-white">Web Portal:</strong> Visit our dedicated{" "}
                      <Link href="/delete-account" className="text-[#11a4d4] hover:underline">
                        Account Deletion Page
                      </Link>
                      .
                    </li>
                    <li>
                      <strong className="text-white">Email Request:</strong> Email us at{" "}
                      <a href="mailto:maternalmind.help@gmail.com" className="text-[#11a4d4]">
                        maternalmind.help@gmail.com
                      </a>
                      .
                    </li>
                  </ul>
                  <p className="text-white/60 leading-relaxed mt-3">
                    Upon confirmation, all your personal data, quiz attempts, study history, and session records will be permanently erased from our active databases within 30 days.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    5. Third-Party Services
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    We use trusted service providers for core infrastructure, authentication, and payment processing (including Apple App Store in-app purchases). These partners operate under strict confidentiality and data protection agreements compliant with applicable privacy laws.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    6. Your Rights & Choices
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    You have the right to access, review, export, or correct your personal data, as well as the right to restrict or object to certain data processing. To exercise any of these rights, contact us at{" "}
                    <a href="mailto:maternalmind.help@gmail.com" className="text-[#11a4d4]">
                      maternalmind.help@gmail.com
                    </a>
                    .
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    7. Children's Privacy
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Maternal Mind is designed for medical students, postgraduates, and healthcare professionals. We do not knowingly collect or solicit personal information from children under 13 years of age.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    8. Contact Us
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    If you have questions, concerns, or requests regarding this Privacy Policy or data protection practices, please contact us:
                  </p>
                  <div className="mt-3 text-sm text-white/70 space-y-1">
                    <p>• WhatsApp: <a href="https://wa.me/923360830836" target="_blank" rel="noreferrer" className="text-[#11a4d4]">+923360830836</a></p>
                    <p>• Web: <a href="https://maternalmind.com.pk/" target="_blank" rel="noreferrer" className="text-[#11a4d4]">https://maternalmind.com.pk/</a></p>
                    <p>• Email: <a href="mailto:maternalmind.help@gmail.com" className="text-[#11a4d4]">maternalmind.help@gmail.com</a></p>
                    <p>• For Book Delivery: <a href="https://wa.me/923212066562" target="_blank" rel="noreferrer" className="text-[#11a4d4]">+923212066562</a></p>
                    <p>• Contact Portal: <Link href="/contact" className="text-[#11a4d4] hover:underline">https://maternalmind.com.pk/contact</Link></p>
                    <p>• Location: Chowk Azam, Layyah, Pakistan</p>
                  </div>
                </section>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-void">
      <SEO
        title="Medical Disclaimer"
        description="Maternal Mind Medical Disclaimer. Important information about the educational nature of our content and its limitations."
        path="/legal/disclaimer"
      />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="mb-4">
              <GlowLink
                href="/legal"
                className="text-sm flex items-center gap-1"
              >
                Legal <ChevronRight className="w-3 h-3" /> Medical Disclaimer
              </GlowLink>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight mb-2">
              Medical Disclaimer
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Last updated: January 2026
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-8">
              <div className="prose prose-invert prose-sm max-w-none space-y-6">
                <div className="glass-strong rounded-md p-4 flex items-start gap-3 mb-6">
                  <AlertTriangle className="w-5 h-5 text-[#eab308] shrink-0 mt-0.5" />
                  <p className="text-sm text-white/80 leading-relaxed">
                    <span className="text-[#eab308] font-medium">
                      Important:
                    </span>{" "}
                    Maternal Mind is strictly an educational platform. It is not
                    a substitute for professional medical judgment, clinical
                    decision-making, or patient care.
                  </p>
                </div>

                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Educational Purpose
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    All content provided through Maternal Mind is intended
                    exclusively for educational purposes, exam preparation, and
                    professional development in the field of Obstetrics and
                    Gynaecology. It is designed to supplement, not replace,
                    formal medical training and clinical experience.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Not Medical Advice
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    The information presented on this platform does not
                    constitute medical advice, diagnosis, or treatment
                    recommendations. Clinical scenarios presented in MCQs and
                    learning content are for educational purposes only and
                    should not be applied directly to patient care without
                    appropriate clinical judgment.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Clinical Decisions
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    All clinical decisions should be made by qualified
                    healthcare professionals based on individual patient
                    assessment, current guidelines, local protocols, and
                    professional judgment. Do not rely solely on content from
                    this platform for patient management.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Content Accuracy
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    While we strive for accuracy and regularly review our
                    content against current evidence, medical knowledge evolves.
                    We do not guarantee that all information is current or
                    complete. Always cross-reference with established guidelines
                    and your institution&apos;s protocols.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Limitation of Responsibility
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    Maternal Mind, its creators, contributors, and affiliates
                    shall not be held liable for any clinical outcomes, patient
                    harm, or professional consequences arising from the use of
                    information provided on this platform.
                  </p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Reporting Concerns
                  </h2>
                  <p className="text-white/60 leading-relaxed">
                    If you identify any content that you believe is inaccurate
                    or potentially harmful, please report it immediately to{" "}
                    <span className="text-[#11a4d4]">
                      content@maternalmind.app
                    </span>
                    . We take content integrity very seriously and will review
                    all reports promptly.
                  </p>
                </section>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
