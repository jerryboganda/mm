import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import HomeScreen from "@/screens/HomeScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import TopicReaderScreen from "@/screens/TopicReaderScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useMobileContent } from "@/lib/mobile-content";

export type HomeStackParamList = {
  Dashboard: undefined;
  Notifications: undefined;
  TopicReader: { topicId: string; topicTitle: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();
  const { resolveText } = useMobileContent();
  const t = resolveText;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title={t("Maternal Mind")} />,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerTitle: t("Announcements"),
        }}
      />
      <Stack.Screen
        name="TopicReader"
        component={TopicReaderScreen}
        options={({ route }) => ({
          headerTitle: route.params.topicTitle,
        })}
      />
    </Stack.Navigator>
  );
}
