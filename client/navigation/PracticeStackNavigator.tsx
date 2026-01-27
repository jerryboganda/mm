import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import PracticeScreen from "@/screens/PracticeScreen";

export type PracticeStackParamList = {
  PracticeHome: undefined;
};

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export default function PracticeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="PracticeHome"
        component={PracticeScreen}
        options={{
          headerTitle: "Practice",
        }}
      />
    </Stack.Navigator>
  );
}
