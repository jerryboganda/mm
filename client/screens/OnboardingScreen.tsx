import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  FlatList,
  Pressable,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width, height } = Dimensions.get("window");

type OnboardingScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    id: "1",
    icon: "book-open",
    title: "Learn at Your Pace",
    description:
      "Access comprehensive OB-GYN content organized into books, chapters, and topics. Study anytime, anywhere.",
    color: Colors.dark.primary,
  },
  {
    id: "2",
    icon: "check-circle",
    title: "Practice with Quizzes",
    description:
      "Test your knowledge with multiple choice questions. Choose topic-based, mixed, or retry wrong answers mode.",
    color: Colors.dark.success,
  },
  {
    id: "3",
    icon: "trending-up",
    title: "Track Your Progress",
    description:
      "Monitor your learning journey with detailed analytics. See your strengths and areas for improvement.",
    color: Colors.dark.warning,
  },
  {
    id: "4",
    icon: "bookmark",
    title: "Bookmark & Review",
    description:
      "Save important topics for quick access. Build your personalized study collection.",
    color: "#e879f9",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const handleComplete = () => {
    navigation.navigate("PermissionsPrompt");
  };

  const renderSlide = ({
    item,
    index,
  }: {
    item: OnboardingSlide;
    index: number;
  }) => {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${item.color}20` },
            ]}
          >
            <Feather name={item.icon} size={64} color={item.color} />
          </View>
          <ThemedText type="h2" style={styles.slideTitle}>
            {item.title}
          </ThemedText>
          <ThemedText style={styles.slideDescription}>
            {item.description}
          </ThemedText>
        </View>
      </View>
    );
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          Colors.dark.backgroundRoot,
          "#0a1518",
          Colors.dark.backgroundRoot,
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
          testID="button-skip"
        >
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        bounces={false}
      />

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity },
                  index === currentIndex && styles.dotActive,
                ]}
              />
            );
          })}
        </View>

        <PrimaryButton
          title={isLastSlide ? "Continue" : "Next"}
          onPress={handleNext}
          style={styles.nextButton}
          icon={
            isLastSlide ? undefined : (
              <Feather
                name="arrow-right"
                size={20}
                color={Colors.dark.backgroundRoot}
              />
            )
          }
          testID="button-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.xl,
  },
  skipButton: {
    padding: Spacing.sm,
  },
  skipText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  slideContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  slideTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  slideDescription: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    color: Colors.dark.textSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  dotActive: {
    backgroundColor: Colors.dark.primary,
  },
  nextButton: {
    width: "100%",
  },
});
