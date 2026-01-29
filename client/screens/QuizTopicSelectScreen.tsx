import React, { useState } from "react";
import { StyleSheet, View, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type QuizTopicSelectNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "QuizTopicSelect"
>;

interface QuizTopic {
  id: string;
  title: string;
  chapterTitle: string;
  questionCount: number;
}

export default function QuizTopicSelectScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<QuizTopicSelectNavigationProp>();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const { data: topics, isLoading } = useQuery<QuizTopic[]>({
    queryKey: ["/api/quiz/topics"],
  });

  const handleStartQuiz = () => {
    if (selectedTopicId) {
      navigation.navigate("QuizPlayer", {
        mode: "topic",
        topicId: selectedTopicId,
      });
    }
  };

  const renderTopic = ({ item }: { item: QuizTopic }) => (
    <GlassCard
      title={item.title}
      subtitle={`${item.chapterTitle} • ${item.questionCount} questions`}
      onPress={() => setSelectedTopicId(item.id)}
      active={selectedTopicId === item.id}
      icon={
        <Feather
          name="file-text"
          size={24}
          color={
            selectedTopicId === item.id
              ? Colors.dark.primary
              : Colors.dark.textSecondary
          }
        />
      }
      testID={`card-topic-${item.id}`}
      style={{ marginBottom: Spacing.md }}
    />
  );

  const renderLoading = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={topics || []}
        renderItem={renderTopic}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={styles.sectionLabel}>SELECT A TOPIC</ThemedText>
            <ThemedText type="small" style={styles.subtitle}>
              Choose a topic to practice MCQs from
            </ThemedText>
          </View>
        }
        ListEmptyComponent={isLoading ? renderLoading() : null}
      />

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <PrimaryButton
          title="Start Quiz"
          onPress={handleStartQuiz}
          disabled={!selectedTopicId}
          icon="play"
          testID="button-start-quiz"
        />
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    marginTop: Spacing.xs,
  },
  footer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    backgroundColor: Colors.dark.backgroundRoot,
    paddingTop: Spacing.lg,
  },
});
