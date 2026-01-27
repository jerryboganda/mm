import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "rgba(255,255,255,0.95)",
    textSecondary: "rgba(255,255,255,0.7)",
    textMuted: "rgba(255,255,255,0.4)",
    buttonText: "#FFFFFF",
    tabIconDefault: "rgba(255,255,255,0.5)",
    tabIconSelected: "#11a4d4",
    link: "#11a4d4",
    primary: "#11a4d4",
    primaryDark: "#0c7fa6",
    backgroundRoot: "#101d22",
    backgroundDefault: "#152228",
    backgroundSecondary: "#1a2a32",
    backgroundTertiary: "#203038",
    glass: "rgba(255,255,255,0.05)",
    glassHover: "rgba(255,255,255,0.1)",
    glassBorder: "rgba(255,255,255,0.1)",
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
    info: "#3b82f6",
    purple: "#a855f7",
  },
  dark: {
    text: "rgba(255,255,255,0.95)",
    textSecondary: "rgba(255,255,255,0.7)",
    textMuted: "rgba(255,255,255,0.4)",
    buttonText: "#FFFFFF",
    tabIconDefault: "rgba(255,255,255,0.5)",
    tabIconSelected: "#11a4d4",
    link: "#11a4d4",
    primary: "#11a4d4",
    primaryDark: "#0c7fa6",
    backgroundRoot: "#101d22",
    backgroundDefault: "#152228",
    backgroundSecondary: "#1a2a32",
    backgroundTertiary: "#203038",
    glass: "rgba(255,255,255,0.05)",
    glassHover: "rgba(255,255,255,0.1)",
    glassBorder: "rgba(255,255,255,0.1)",
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
    info: "#3b82f6",
    purple: "#a855f7",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 56,
  "7xl": 64,
  inputHeight: 56,
  buttonHeight: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "300" as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "500" as const,
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  mono: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
};

export const Shadows = {
  glow: {
    shadowColor: "#11a4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  glowSmall: {
    shadowColor: "#11a4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "Inter",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "Menlo",
  },
  default: {
    sans: "Inter",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
