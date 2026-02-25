import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useMobileContent } from "@/lib/mobile-content";

import ProfileScreen from "@/screens/ProfileScreen";

export type ProfileStackParamList = {
  ProfileHome: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();
  const { resolveText } = useMobileContent();
  const t = resolveText;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{
          headerTitle: t("Profile"),
        }}
      />
    </Stack.Navigator>
  );
}
