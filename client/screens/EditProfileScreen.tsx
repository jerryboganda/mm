import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (name !== user?.name || photoUri) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [name, photoUri, user?.name]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
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
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    updateProfileMutation.mutate({ name: name.trim() });
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
          <Pressable onPress={handlePickImage} style={styles.photoContainer}>
            <Image
              source={
                photoUri
                  ? { uri: photoUri }
                  : require("../../assets/images/default-avatar.png")
              }
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.editBadge}>
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <ThemedText style={styles.photoHint}>Tap to change photo</ThemedText>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionLabel}>PERSONAL INFO</ThemedText>

          <GlassCard style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>Full Name</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={Colors.dark.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              testID="input-name"
            />
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>Email</ThemedText>
            <ThemedText style={styles.emailText}>{user?.email}</ThemedText>
            <ThemedText style={styles.emailHint}>
              Email cannot be changed
            </ThemedText>
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <ThemedText style={styles.inputLabel}>Mobile Number</ThemedText>
                {user?.isPhoneVerified ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather
                      name="check-circle"
                      size={14}
                      color={Colors.dark.success}
                      style={{ marginRight: 6 }}
                    />
                    <ThemedText
                      style={{ color: Colors.dark.success, fontSize: 14 }}
                    >
                      Verified
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText
                    style={{ color: Colors.dark.error, fontSize: 14 }}
                  >
                    Not Verified
                  </ThemedText>
                )}
              </View>
              <Pressable
                onPress={() => navigation.navigate("VerifyPhone" as never)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  padding: 8,
                })}
              >
                <ThemedText
                  style={{
                    color: Colors.dark.primary,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {user?.isPhoneVerified ? "Update" : "Verify Now"}
                </ThemedText>
              </Pressable>
            </View>
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
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
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
    borderColor: Colors.dark.primary,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.dark.backgroundRoot,
  },
  photoHint: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  formSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  inputCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: 16,
    color: Colors.dark.text,
    padding: 0,
    fontFamily: "Inter_400Regular",
  },
  emailText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  emailHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
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
    color: Colors.dark.textMuted,
  },
});
