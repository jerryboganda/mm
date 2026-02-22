import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  glowing?: boolean;
}

export function MaternalMindLogo({ size = 32, className, glowing = false }: LogoProps) {
  const id = glowing ? "lg" : "sm";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(glowing && "drop-shadow-[0_0_20px_rgba(17,164,212,0.5)]", className)}
      data-testid="logo-mark"
    >
      <defs>
        <radialGradient id={`logoGlow-${id}`} cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#11a4d4" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#11a4d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`grad-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#11a4d4" />
          <stop offset="100%" stopColor="#0c7fa6" />
        </linearGradient>
        <linearGradient id={`fill-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#11a4d4" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0c7fa6" stopOpacity="0.04" />
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {glowing && <circle cx="60" cy="40" r="55" fill={`url(#logoGlow-${id})`} />}

      <path
        d="M 60 6
           C 78 6, 94 14, 100 28
           C 106 42, 102 52, 96 56
           L 24 56
           C 18 52, 14 42, 20 28
           C 26 14, 42 6, 60 6 Z"
        fill={`url(#fill-${id})`}
        stroke={`url(#grad-${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M 22 42
           C 16 48, 8 58, 6 68
           C 4 78, 10 84, 18 82
           C 24 80, 28 74, 30 68
           C 34 58, 38 50, 40 44
           C 36 40, 28 38, 22 42 Z"
        fill={`url(#fill-${id})`}
        stroke={`url(#grad-${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M 98 42
           C 104 48, 112 58, 114 68
           C 116 78, 110 84, 102 82
           C 96 80, 92 74, 90 68
           C 86 58, 82 50, 80 44
           C 84 40, 92 38, 98 42 Z"
        fill={`url(#fill-${id})`}
        stroke={`url(#grad-${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M 42 50
           C 44 58, 48 68, 52 78
           C 55 86, 58 96, 60 106
           C 62 96, 65 86, 68 78
           C 72 68, 76 58, 78 50 Z"
        fill={`url(#fill-${id})`}
        stroke={`url(#grad-${id})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <g filter={`url(#glow-${id})`} opacity="0.7">
        <line x1="60" y1="14" x2="74" y2="22" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="74" y1="22" x2="74" y2="40" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="74" y1="40" x2="60" y2="48" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="60" y1="48" x2="46" y2="40" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="46" y1="40" x2="46" y2="22" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="46" y1="22" x2="60" y2="14" stroke="#11a4d4" strokeWidth="1" opacity="0.6" />
        <line x1="60" y1="14" x2="60" y2="48" stroke="#11a4d4" strokeWidth="0.8" opacity="0.4" />
        <line x1="46" y1="22" x2="74" y2="40" stroke="#11a4d4" strokeWidth="0.8" opacity="0.4" />
        <line x1="74" y1="22" x2="46" y2="40" stroke="#11a4d4" strokeWidth="0.8" opacity="0.4" />
        <line x1="60" y1="31" x2="46" y2="22" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="31" x2="74" y2="22" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="31" x2="46" y2="40" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="31" x2="74" y2="40" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="31" x2="60" y2="14" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
        <line x1="60" y1="31" x2="60" y2="48" stroke="#11a4d4" strokeWidth="0.8" opacity="0.3" />
      </g>

      <g filter={`url(#glow-${id})`}>
        <circle cx="60" cy="31" r="3.5" fill="#11a4d4" />
        <circle cx="60" cy="31" r="5.5" fill="#11a4d4" opacity="0.15" />
        <circle cx="60" cy="14" r="2.5" fill="#11a4d4" opacity="0.9" />
        <circle cx="74" cy="22" r="2.5" fill="#11a4d4" opacity="0.9" />
        <circle cx="74" cy="40" r="2.5" fill="#11a4d4" opacity="0.9" />
        <circle cx="60" cy="48" r="2.5" fill="#11a4d4" opacity="0.9" />
        <circle cx="46" cy="40" r="2.5" fill="#11a4d4" opacity="0.9" />
        <circle cx="46" cy="22" r="2.5" fill="#11a4d4" opacity="0.9" />
      </g>
    </svg>
  );
}
