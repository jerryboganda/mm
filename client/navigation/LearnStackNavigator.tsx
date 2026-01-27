import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import LearnScreen from "@/screens/LearnScreen";
import ChaptersScreen from "@/screens/ChaptersScreen";
import TopicsScreen from "@/screens/TopicsScreen";
import { HeaderTitle } from "@/components/HeaderTitle";

export type LearnStackParamList = {
  LearnHome: undefined;
  Chapters: { bookId: string; bookTitle: string };
  Topics: { chapterId: string; chapterTitle: string; bookId: string };
};

const Stack = createNativeStackNavigator<LearnStackParamList>();

export default function LearnStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="LearnHome"
        component={LearnScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Maternal Mind" />,
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
    </Stack.Navigator>
  );
}
