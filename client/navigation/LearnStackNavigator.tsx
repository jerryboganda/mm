import React from "react";
import { Pressable } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useScreenOptions } from "@/hooks/useScreenOptions";
import LearnScreen from "@/screens/LearnScreen";
import ChaptersScreen from "@/screens/ChaptersScreen";
import TopicsScreen from "@/screens/TopicsScreen";
import TopicReaderScreen from "@/screens/TopicReaderScreen";
import SearchScreen from "@/screens/SearchScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors, Spacing } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export type LearnStackParamList = {
  LearnHome: undefined;
  Chapters: { bookId: string; bookTitle: string };
  Topics: { chapterId: string; chapterTitle: string; bookId: string };
  TopicReader: { topicId: string; topicTitle: string };
  Search: undefined;
};

const Stack = createNativeStackNavigator<LearnStackParamList>();

function SearchButton() {
  const navigation = useNavigation<NativeStackNavigationProp<LearnStackParamList>>();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Search");
  };

  return (
    <Pressable onPress={handlePress} style={{ padding: Spacing.sm }} hitSlop={10}>
      <Feather name="search" size={22} color={Colors.dark.text} />
    </Pressable>
  );
}

export default function LearnStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="LearnHome"
        component={LearnScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Library" />,
          headerRight: () => <SearchButton />,
        }}
      />
      <Stack.Screen
        name="Chapters"
        component={ChaptersScreen}
        options={({ route }) => ({
          headerTitle: route.params.bookTitle,
        })}
      />
      <Stack.Screen
        name="Topics"
        component={TopicsScreen}
        options={({ route }) => ({
          headerTitle: route.params.chapterTitle,
        })}
      />
      <Stack.Screen
        name="TopicReader"
        component={TopicReaderScreen}
        options={({ route }) => ({
          headerTitle: route.params.topicTitle,
        })}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          headerTitle: "Search",
        }}
      />
    </Stack.Navigator>
  );
}
