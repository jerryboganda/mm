import { Link } from "wouter";
import { Mail, ArrowRight } from "lucide-react";
import { SiLinkedin, SiX } from "react-icons/si";
import { GlowLink, NeonButton } from "./glass-components";
import { useState } from "react";
import { MaternalMindLogo } from "./logo";

const footerLinks = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "For Institutions", href: "/institutions" },
  ],
  Resources: [
    { label: "MRCOG Part 1", href: "/resources/mrcog-part-1" },
    { label: "MRCOG Part 2", href: "/resources/mrcog-part-2" },
    { label: "MRCOG Part 3", href: "/resources/mrcog-part-3" },
    { label: "FCPS OB-GYN", href: "/resources/fcps-obgyn" },
    { label: "OB-GYN MCQs", href: "/resources/obgyn-mcqs" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Support", href: "/support" },
    { label: "Media Kit", href: "/media" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "Disclaimer", href: "/legal/disclaimer" },
  ],
};

export function Footer() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        setSubmitError("Subscription failed. Please try again.");
        return;
      }

      setEmail("");
      setSubmitSuccess(true);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0a1519] border-t border-white/5" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <MaternalMindLogo size={32} />
              <span className="text-lg font-semibold text-white tracking-tight">
                Maternal Mind
              </span>
            </Link>
            <p className="text-sm text-white/50 max-w-xs mb-6 leading-relaxed">
              Premium OB-GYN educational platform for postgraduate doctors. Learn, practice, and track your progress.
            </p>

            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">Stay updated</p>
              <form onSubmit={handleNewsletterSubmit}>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email"
                    className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/30 focus:outline-none focus:border-[#11a4d4]/40"
                    data-testid="input-newsletter-email"
                    required
                  />
                  <NeonButton size="sm" data-testid="button-subscribe" type="submit" disabled={isSubmitting}>
                    <ArrowRight className="w-4 h-4" />
                  </NeonButton>
                </div>
                {submitError && (
                  <p className="mt-2 text-xs text-[#ef4444]" data-testid="text-newsletter-error">
                    {submitError}
                  </p>
                )}
                {submitSuccess && (
                  <p className="mt-2 text-xs text-[#22c55e]" data-testid="text-newsletter-success">
                    Subscribed successfully.
                  </p>
                )}
              </form>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="mailto:support@maternalmind.app"
                className="w-9 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-[#11a4d4] hover:border-[#11a4d4]/30 transition-all"
                data-testid="link-email"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/company/maternal-mind"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-[#11a4d4] hover:border-[#11a4d4]/30 transition-all"
                data-testid="link-linkedin"
                aria-label="LinkedIn"
              >
                <SiLinkedin className="w-4 h-4" />
              </a>
              <a
                href="https://x.com/maternalmindapp"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-[#11a4d4] hover:border-[#11a4d4]/30 transition-all"
                data-testid="link-x"
                aria-label="X"
              >
                <SiX className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-medium uppercase tracking-widest text-white/40 mb-4">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <GlowLink href={link.href} className="text-sm text-white/60 hover:text-[#11a4d4]">
                      {link.label}
                    </GlowLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} Maternal Mind. All rights reserved.
            </p>
            <p className="text-xs text-white/30 text-center sm:text-right max-w-md">
              For educational purposes only. Not intended as medical advice. Consult qualified healthcare professionals for clinical decisions.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
