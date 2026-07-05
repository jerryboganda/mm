import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { apiUpload } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "PaymentProofUpload">;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface PickedImage {
  uri: string;
  mimeType: string;
  fileName: string;
}

/**
 * apiUpload/apiRequest throw `Error("<status>: <raw body>")`. Extract the
 * HTTP status and a clean message (parsing JSON bodies like
 * `{"message": "..."}`) instead of surfacing the raw response text to users.
 */
function parseApiError(err: unknown): {
  status: number | null;
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const match = raw.match(/^(\d+):\s*([\s\S]*)$/);
  const status = match ? Number(match[1]) : null;
  const body = match ? match[2] : raw;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.message === "string") {
      return { status, message: parsed.message };
    }
  } catch {
    // Not JSON — fall through to the raw text below.
  }
  return { status, message: body };
}

export default function PaymentProofUploadScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();

  const { packageId, priceId, packageName, price } = route.params;

  const [image, setImage] = useState<PickedImage | null>(null);
  const [amount, setAmount] = useState(price || "");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If our subscription turns out to already be active (e.g. the server
  // rejected this submission because one already exists), jump straight into
  // the app instead of leaving the user stuck on this upload form.
  useEffect(() => {
    if (user?.subscriptionStatus === "active") {
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    }
  }, [user?.subscriptionStatus, navigation]);

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to upload your payment proof.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      setImage({
        uri: asset.uri,
        mimeType,
        fileName: asset.fileName || `payment-proof.${ext}`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      Alert.alert("Proof Required", "Please attach a screenshot of your payment.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      const formData = new FormData();

      if (Platform.OS === "web") {
        const resp = await fetch(image.uri);
        const blob = await resp.blob();
        formData.append("proof", blob, image.fileName);
      } else {
        formData.append("proof", {
          uri: image.uri,
          name: image.fileName,
          type: image.mimeType,
        } as any);
      }

      formData.append("packageId", packageId);
      formData.append("priceId", priceId);
      if (amount.trim()) formData.append("amountClaimed", amount.trim());
      if (method.trim()) formData.append("paymentMethod", method.trim());
      if (reference.trim()) formData.append("senderReference", reference.trim());
      if (note.trim()) formData.append("userNote", note.trim());

      await apiUpload("/api/subscriptions/proof", formData);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("PendingApproval");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const { status, message } = parseApiError(err);

      // Don't leave the user stuck on a dead-end alert — route them to
      // where they actually belong instead of just re-showing this form.
      if (status === 409 && /payment proof awaiting review/i.test(message)) {
        navigation.replace("PendingApproval");
        return;
      }
      if (status === 409 && /active subscription/i.test(message)) {
        // Our local state was stale. Refresh it — the effect above will
        // navigate into the app once the server confirms it's active.
        await refreshUser();
        Alert.alert(
          "Already Subscribed",
          "You already have an active subscription. Taking you into the app.",
        );
        return;
      }

      Alert.alert(
        "Upload Failed",
        message || "We couldn't submit your payment proof. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.glass, borderColor: theme.glassBorder, color: theme.text },
  ];

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.summary, { color: theme.textSecondary }]}>
          {packageName} — PKR {price}
        </ThemedText>

        <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
          PAYMENT SCREENSHOT
        </ThemedText>

        <Pressable
          onPress={handlePickImage}
          style={[
            styles.imagePicker,
            { borderColor: theme.glassBorder, backgroundColor: theme.glass },
          ]}
        >
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.pickerPlaceholder}>
              <Feather name="image" size={32} color={theme.textMuted} />
              <ThemedText style={[styles.pickerText, { color: theme.textSecondary }]}>
                Tap to attach your payment receipt
              </ThemedText>
            </View>
          )}
        </Pressable>
        {image ? (
          <Pressable onPress={handlePickImage} style={styles.changeLink}>
            <ThemedText style={{ color: theme.primary, fontSize: 13 }}>
              Choose a different image
            </ThemedText>
          </Pressable>
        ) : null}

        <ThemedText style={[styles.sectionLabel, { color: theme.primary, marginTop: Spacing.xl }]}>
          DETAILS (OPTIONAL)
        </ThemedText>

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Amount paid
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Amount"
          placeholderTextColor={theme.textMuted}
        />

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Payment method
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={method}
          onChangeText={setMethod}
          placeholder="e.g. Bank Transfer, JazzCash"
          placeholderTextColor={theme.textMuted}
        />

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Sender name / transaction ID
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={reference}
          onChangeText={setReference}
          placeholder="So we can match your payment"
          placeholderTextColor={theme.textMuted}
        />

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Note
        </ThemedText>
        <TextInput
          style={[inputStyle, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="Anything we should know?"
          placeholderTextColor={theme.textMuted}
          multiline
        />

        <PrimaryButton
          title={submitting ? "Submitting..." : "Submit for Review"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitButton}
          testID="button-submit-proof"
        />
        {submitting ? (
          <View style={styles.submittingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <ThemedText style={[styles.submittingText, { color: theme.textMuted }]}>
              Uploading your proof...
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  summary: { fontSize: 14, marginBottom: Spacing.lg, textAlign: "center" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  imagePicker: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerPlaceholder: { alignItems: "center", gap: Spacing.sm, padding: Spacing.lg },
  pickerText: { fontSize: 14, textAlign: "center" },
  preview: { width: "100%", height: "100%" },
  changeLink: { alignSelf: "center", marginTop: Spacing.sm },
  fieldLabel: { fontSize: 13, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  textArea: { height: 90, textAlignVertical: "top" },
  submitButton: { marginTop: Spacing.xl },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  submittingText: { fontSize: 13 },
});
