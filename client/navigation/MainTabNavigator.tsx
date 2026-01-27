import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import LearnStackNavigator from "@/navigation/LearnStackNavigator";
import PracticeStackNavigator from "@/navigation/PracticeStackNavigator";
import ProgressStackNavigator from "@/navigation/ProgressStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { Colors } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  LibraryTab: undefined;
  QuizTab: undefined;
  ProgressTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.dark.backgroundRoot,
            web: Colors.dark.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.select({
            ios: 88,
            android: 64,
            web: 64,
          }),
          paddingBottom: Platform.select({
            ios: 28,
            android: 8,
            web: 8,
          }),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.dark.backgroundRoot }]}>
              <LinearGradient
                colors={["rgba(16,29,34,0.95)", Colors.dark.backgroundRoot]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            </View>
          ),
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LearnStackNavigator}
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Feather name="book-open" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="QuizTab"
        component={PracticeStackNavigator}
        options={{
          title: "Quiz",
          tabBarIcon: ({ color, size }) => (
            <Feather name="edit-3" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressStackNavigator}
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Feather name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
