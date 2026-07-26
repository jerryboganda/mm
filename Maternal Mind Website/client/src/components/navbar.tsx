import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { NeonButton, GhostButton } from "./glass-components";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MaternalMindLogo } from "./logo";
import { openAppDownload } from "@/lib/app-links";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/institutions", label: "For Institutions" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#101d22]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      )}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-home">
            <MaternalMindLogo size={32} />
            <span className="text-lg font-semibold text-white tracking-tight">
              Maternal Mind
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-all duration-200",
                  location === link.href || (link.href !== "/" && location.startsWith(link.href))
                    ? "text-[#11a4d4] bg-[#11a4d4]/5"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/support">
              <GhostButton size="sm" data-testid="button-support">Support</GhostButton>
            </Link>
            <Link href="/download">
              <NeonButton size="sm" data-testid="button-get-app">
                Get the App
              </NeonButton>
            </Link>
          </div>

          <button
            className="lg:hidden p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#101d22]/95 backdrop-blur-xl border-b border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block px-4 py-3 rounded-md text-sm transition-all",
                    location === link.href || (link.href !== "/" && location.startsWith(link.href))
                      ? "text-[#11a4d4] bg-[#11a4d4]/5"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <Link href="/support" className="block">
                  <GhostButton className="w-full" size="sm">Support</GhostButton>
                </Link>
                <Link href="/download" className="block">
                  <NeonButton className="w-full" size="sm">
                    Get the App
                  </NeonButton>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
