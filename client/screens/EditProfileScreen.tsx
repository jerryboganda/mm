import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { useMobileContent } from "@/lib/mobile-content";
import { apiRequest } from "@/lib/query-client";
import { useNetwork } from "@/lib/network";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;
  const { isOffline } = useNetwork();

  const [name, setName] = useState(user?.name || "");
  const [photoUri, setPhotoUri] = useState<string | null>(
    user?.avatarUrl || null,
  );
  const hasChanges =
    name !== (user?.name || "") || photoUri !== (user?.avatarUrl || null);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; avatarUrl?: string | null }) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      return response.json();
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshUser();
      navigation.goBack();
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to update profile");
    },
  });

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to change your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        const mimeType = asset.mimeType || "image/jpeg";
        setPhotoUri(`data:${mimeType};base64,${asset.base64}`);
      } else {
        setPhotoUri(asset.uri);
      }
    }
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isOffline) {
      Alert.alert(
        t("No Internet"),
        t(
          "Updating your profile requires an internet connection. Please try again when you're online.",
        ),
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      avatarUrl: photoUri,
    });
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (hasChanges) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.photoSection}>
          <Pressable
            onPress={handlePickImage}
            style={styles.photoContainer}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityHint="Opens photo library to select a new profile picture"
          >
            <Image
              source={
                photoUri
                  ? { uri: photoUri }
                  : require("../../assets/images/default-avatar.png")
              }
              style={[styles.photo, { borderColor: theme.primary }]}
              contentFit="cover"
              transition={0}
            />
            <View
              style={[
                styles.editBadge,
                {
                  backgroundColor: theme.primary,
                  borderColor: theme.backgroundRoot,
                },
              ]}
            >
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <ThemedText style={[styles.photoHint, { color: theme.textMuted }]}>
            Tap to change photo
          </ThemedText>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            PERSONAL INFO
          </ThemedText>

          <GlassCard style={styles.inputCard}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Full Name
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: theme.text }]}
              placeholder={t("Enter your name")}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              testID="input-name"
              accessibilityLabel="Full Name"
            />
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Email
            </ThemedText>
            <ThemedText style={[styles.emailText, { color: theme.text }]}>
              {user?.email}
            </ThemedText>
            <ThemedText style={[styles.emailHint, { color: theme.textMuted }]}>
              Email cannot be changed
            </ThemedText>
          </GlassCard>
        </View>

        <View style={styles.buttonSection}>
          <PrimaryButton
            title={
              updateProfileMutation.isPending ? "Saving..." : "Save Changes"
            }
            onPress={handleSave}
            disabled={!hasChanges || updateProfileMutation.isPending}
            style={styles.saveButton}
            testID="button-save-profile"
          />
          <Pressable
            onPress={handleCancel}
            style={styles.cancelButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
          >
            <ThemedText style={[styles.cancelText, { color: theme.textMuted }]}>
              Cancel
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  photoContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  photoHint: {
    fontSize: 13,
  },
  formSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  inputCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: 16,
    padding: 0,
    fontFamily: "Inter_400Regular",
  },
  emailText: {
    fontSize: 16,
  },
  emailHint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  buttonSection: {
    marginTop: Spacing["2xl"],
  },
  saveButton: {
    marginBottom: Spacing.lg,
  },
  cancelButton: {
    alignItems: "center",
    padding: Spacing.md,
  },
  cancelText: {
    fontSize: 15,
  },
});
