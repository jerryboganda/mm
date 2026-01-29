import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function QuizSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [questionsCount, setQuestionsCount] = useState(10);
  const [difficulty, setDifficulty] = useState<
    "all" | "easy" | "medium" | "hard"
  >("all");

  const timerOptions = [5, 10, 15, 20, 30];
  const questionOptions = [5, 10, 15, 20, 25];
  const difficultyOptions: {
    id: "all" | "easy" | "medium" | "hard";
    label: string;
  }[] = [
    { id: "all", label: "All" },
    { id: "easy", label: "Easy" },
    { id: "medium", label: "Medium" },
    { id: "hard", label: "Hard" },
  ];

  const handleToggleTimer = (value: boolean) => {
    setTimerEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>TIMER</ThemedText>
          <GlassCard style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="clock" size={20} color={Colors.dark.primary} />
                <ThemedText style={styles.settingTitle}>
                  Enable Timer
                </ThemedText>
              </View>
              <Switch
                value={timerEnabled}
                onValueChange={handleToggleTimer}
                trackColor={{
                  false: Colors.dark.glass,
                  true: Colors.dark.primary,
                }}
                thumbColor="#fff"
              />
            </View>
            {timerEnabled ? (
              <View style={styles.optionsRow}>
                {timerOptions.map((mins) => (
                  <Pressable
                    key={mins}
                    onPress={() => {
                      setTimerMinutes(mins);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.optionChip,
                      timerMinutes === mins && styles.optionChipSelected,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        timerMinutes === mins && styles.optionTextSelected,
                      ]}
                    >
                      {mins}m
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>
            QUESTIONS PER QUIZ
          </ThemedText>
          <GlassCard style={styles.settingCard}>
            <View style={styles.optionsRow}>
              {questionOptions.map((count) => (
                <Pressable
                  key={count}
                  onPress={() => {
                    setQuestionsCount(count);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.optionChip,
                    questionsCount === count && styles.optionChipSelected,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      questionsCount === count && styles.optionTextSelected,
                    ]}
                  >
                    {count}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>DIFFICULTY</ThemedText>
          <GlassCard style={styles.settingCard}>
            <View style={styles.optionsRow}>
              {difficultyOptions.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setDifficulty(opt.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.optionChip,
                    styles.difficultyChip,
                    difficulty === opt.id && styles.optionChipSelected,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      difficulty === opt.id && styles.optionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </View>

        <View style={styles.infoBox}>
          <Feather name="info" size={16} color={Colors.dark.primary} />
          <ThemedText style={styles.infoText}>
            Settings will apply to your next quiz session. Timer pauses when you
            leave the quiz screen.
          </ThemedText>
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.md,
  },
  settingCard: {
    padding: Spacing.lg,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingTitle: {
    marginLeft: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.glass,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  optionChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  difficultyChip: {
    flex: 1,
    alignItems: "center",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  optionTextSelected: {
    color: "#fff",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "rgba(17,164,212,0.1)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md,
  },
});
