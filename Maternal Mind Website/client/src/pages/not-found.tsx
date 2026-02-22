import { Link } from "wouter";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { NeonButton, GhostButton, BackgroundOrbs, ScrollReveal, GlassCard } from "@/components/glass-components";
import { SEO } from "@/components/seo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      <SEO title="Page Not Found" description="The page you are looking for does not exist or has been moved." path="/404" />
      <BackgroundOrbs />
      <ScrollReveal>
        <GlassCard className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mx-auto mb-6">
            <Stethoscope className="w-8 h-8 text-[#11a4d4]" />
          </div>
          <h1 className="text-5xl font-light text-[#11a4d4] neon-text-glow mb-2">404</h1>
          <p className="text-lg font-medium text-white mb-2">Page Not Found</p>
          <p className="text-sm text-white/50 mb-8">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/">
              <NeonButton data-testid="button-404-home">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </NeonButton>
            </Link>
            <Link href="/support">
              <GhostButton data-testid="button-404-support">Get Help</GhostButton>
            </Link>
          </div>
        </GlassCard>
      </ScrollReveal>
    </div>
  );
}
