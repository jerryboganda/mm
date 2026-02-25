import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useMobileContent } from "@/lib/mobile-content";

import PracticeScreen from "@/screens/PracticeScreen";

export type PracticeStackParamList = {
  PracticeHome: undefined;
};

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export default function PracticeStackNavigator() {
  const screenOptions = useScreenOptions();
  const { resolveText } = useMobileContent();
  const t = resolveText;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="PracticeHome"
        component={PracticeScreen}
        options={{
          headerTitle: t("Practice"),
        }}
      />
    </Stack.Navigator>
  );
}
