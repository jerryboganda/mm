import { Text, type TextProps } from "react-native";

import { Colors, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export type ThemedTextProps = TextProps & {
  type?:
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "small"
  | "caption"
  | "label"
  | "link"
  | "stat";
};

export function ThemedText({ style, type = "body", ...rest }: ThemedTextProps) {
  const { theme } = useTheme();

  const getColor = () => {
    if (type === "link") {
      return theme.link;
    }
    return theme.text;
  };

  const getTypeStyle = () => {
    switch (type) {
      case "h1":
        return { ...Typography.h1, fontFamily: "Inter_300Light" };
      case "h2":
        return { ...Typography.h2, fontFamily: "Inter_600SemiBold" };
      case "h3":
        return { ...Typography.h3, fontFamily: "Inter_500Medium" };
      case "h4":
        return { ...Typography.h4, fontFamily: "Inter_600SemiBold" };
      case "body":
        return { ...Typography.body, fontFamily: "Inter_400Regular" };
      case "small":
        return { ...Typography.small, fontFamily: "Inter_400Regular" };
      case "caption":
        return { ...Typography.caption, fontFamily: "Inter_400Regular" };
      case "label":
        return { ...Typography.label, fontFamily: "Inter_500Medium" };
      case "link":
        return { ...Typography.link, fontFamily: "Inter_400Regular" };
      case "stat":
        return { ...Typography.stat, fontFamily: "Inter_700Bold" };
      default:
        return { ...Typography.body, fontFamily: "Inter_400Regular" };
    }
  };

  return (
    <Text maxFontSizeMultiplier={1.5} style={[{ color: getColor() }, getTypeStyle(), style]} {...rest} />
  );
}
