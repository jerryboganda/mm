import { Text, type TextProps } from "react-native";

import { Colors, Typography } from "@/constants/theme";

export type ThemedTextProps = TextProps & {
  type?: "h1" | "h2" | "h3" | "h4" | "body" | "small" | "caption" | "label" | "link";
};

export function ThemedText({
  style,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const getColor = () => {
    if (type === "link") {
      return Colors.dark.link;
    }
    return Colors.dark.text;
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
      default:
        return { ...Typography.body, fontFamily: "Inter_400Regular" };
    }
  };

  return (
    <Text style={[{ color: getColor() }, getTypeStyle(), style]} {...rest} />
  );
}
