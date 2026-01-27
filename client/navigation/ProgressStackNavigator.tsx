import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import ProgressScreen from "@/screens/ProgressScreen";

export type ProgressStackParamList = {
  ProgressHome: undefined;
};

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export default function ProgressStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ProgressHome"
        component={ProgressScreen}
        options={{
          headerTitle: "Your Progress",
        }}
      />
    </Stack.Navigator>
  );
}
