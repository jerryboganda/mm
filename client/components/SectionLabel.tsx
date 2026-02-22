import React from "react";
import { StyleSheet, Text, TextStyle, StyleProp } from "react-native";
import { Colors } from "@/constants/theme";

interface SectionLabelProps {
    children: string;
    style?: StyleProp<TextStyle>;
}

/**
 * SectionLabel — matches the website's SectionLabel component:
 * uppercase, tracking-widest, cyan accent, 12px medium weight.
 */
export function SectionLabel({ children, style }: SectionLabelProps) {
    return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
    label: {
        fontSize: 12,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 2,
        color: "#11a4d4",
    },
});
