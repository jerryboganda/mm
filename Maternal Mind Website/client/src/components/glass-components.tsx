import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Link } from "wouter";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  glow?: boolean;
  children: React.ReactNode;
}

export function GlassCard({ className, glow, children, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "glass rounded-md transition-all duration-300",
        glow && "neon-border neon-glow",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function GlassPanel({ className, children, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "glass-strong rounded-md",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "lg" | "sm";
  children: React.ReactNode;
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, size = "default", children, ...props }, ref) => {
    const sizeClasses = {
      default: "px-6 py-3 text-sm",
      lg: "px-8 py-4 text-base",
      sm: "px-4 py-2 text-sm",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 font-medium rounded-md",
          "bg-[#11a4d4] text-white transition-all duration-300",
          "shadow-[0_0_20px_rgba(17,164,212,0.3),0_0_40px_rgba(17,164,212,0.1)]",
          "hover:shadow-[0_0_30px_rgba(17,164,212,0.5),0_0_60px_rgba(17,164,212,0.2)]",
          "hover:bg-[#0c7fa6]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11a4d4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101d22]",
          "disabled:opacity-50 disabled:pointer-events-none",
          "overflow-hidden",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
        <span className="absolute inset-0 overflow-hidden rounded-md">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:animate-sweep" />
        </span>
      </button>
    );
  }
);
NeonButton.displayName = "NeonButton";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "lg" | "sm";
  children: React.ReactNode;
}

export const GhostButton = forwardRef<HTMLButtonElement, GhostButtonProps>(
  ({ className, size = "default", children, ...props }, ref) => {
    const sizeClasses = {
      default: "px-6 py-3 text-sm",
      lg: "px-8 py-4 text-base",
      sm: "px-4 py-2 text-sm",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium rounded-md",
          "border border-white/10 text-white/90 transition-all duration-300",
          "hover:bg-white/5 hover:border-[#11a4d4]/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11a4d4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101d22]",
          "disabled:opacity-50 disabled:pointer-events-none",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
GhostButton.displayName = "GhostButton";

interface GlowLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}

export function GlowLink({ href, children, className, external }: GlowLinkProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "text-[#11a4d4] transition-all duration-300",
          "hover:text-[#3dbde8] hover:drop-shadow-[0_0_8px_rgba(17,164,212,0.4)]",
          className
        )}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "text-[#11a4d4] transition-all duration-300",
        "hover:text-[#3dbde8] hover:drop-shadow-[0_0_8px_rgba(17,164,212,0.4)]",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "text-xs font-medium uppercase tracking-widest text-[#11a4d4]",
      className
    )}>
      {children}
    </span>
  );
}

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="orb orb-cyan w-[600px] h-[600px] -top-[200px] -left-[200px] animate-float-slow" />
      <div className="orb orb-purple w-[500px] h-[500px] top-[40%] -right-[150px] animate-float" style={{ animationDelay: "2s" }} />
      <div className="orb orb-teal w-[400px] h-[400px] bottom-[10%] left-[30%] animate-float-slow" style={{ animationDelay: "4s" }} />
    </div>
  );
}

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
