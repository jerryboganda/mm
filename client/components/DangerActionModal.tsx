import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { AppModalSurface } from "@/components/AppModalSurface";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Acknowledgement = {
  id: string;
  label: string;
};

type DangerActionModalProps = {
  visible: boolean;
  mode: "confirm" | "success";
  tone: "warning" | "danger";
  icon: keyof typeof Feather.glyphMap;
  eyebrowLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon?: keyof typeof Feather.glyphMap;
  cancelLabel?: string;
  consequenceTitle: string;
  consequences: string[];
  acknowledgements: Acknowledgement[];
  checkedAcknowledgements: string[];
  onToggleAcknowledgement: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  errorMessage?: string | null;
  dismissible?: boolean;
};

export function DangerActionModal({
  visible,
  mode,
  tone,
  icon,
  eyebrowLabel,
  title,
  description,
  confirmLabel,
  confirmIcon,
  cancelLabel = "Cancel",
  consequenceTitle,
  consequences,
  acknowledgements,
  checkedAcknowledgements,
  onToggleAcknowledgement,
  onClose,
  onConfirm,
  loading = false,
  errorMessage,
  dismissible = true,
}: DangerActionModalProps) {
  const { theme } = useTheme();
  const isSuccess = mode === "success";
  const accentColor = isSuccess
    ? theme.success
    : tone === "danger"
      ? theme.error
      : theme.warning;
  const allAcknowledged = acknowledgements.every((item) =>
    checkedAcknowledgements.includes(item.id),
  );
  const confirmDisabled = !isSuccess && (!allAcknowledged || loading);
  const actionVariant =
    tone === "danger" && !isSuccess ? "danger" : "secondary";

  const handleBackdropPress = () => {
    if (dismissible && !loading) {
      onClose();
    }
  };

  const footer = (
    <View style={styles.buttonGroup}>
      {!isSuccess ? (
        <PrimaryButton
          title={cancelLabel}
          onPress={onClose}
          variant="ghost"
          disabled={loading}
          style={styles.secondaryButton}
        />
      ) : null}
      <PrimaryButton
        title={confirmLabel}
        onPress={onConfirm}
        variant={actionVariant}
        icon={confirmIcon}
        loading={loading}
        disabled={confirmDisabled}
        style={styles.primaryButton}
      />
    </View>
  );

  return (
    <AppModalSurface
      visible={visible}
      variant="center"
      onClose={handleBackdropPress}
      dismissible={dismissible && !loading}
      scrollable
      showCloseButton={dismissible}
      accessibilityLabel={title}
      footer={footer}
    >
      <View style={styles.headerRow}>
        <View
          style={[styles.eyebrow, { backgroundColor: `${accentColor}24` }]}
        >
          <ThemedText style={[styles.eyebrowText, { color: accentColor }]}>
            {eyebrowLabel ?? (isSuccess ? "Completed" : "Danger Zone")}
          </ThemedText>
        </View>
      </View>

      <View style={styles.iconWrap}>
        <LinearGradient
          colors={[accentColor, `${accentColor}CC`]}
          style={styles.iconGradient}
        >
          <Feather name={icon} size={28} color="#fff" />
        </LinearGradient>
      </View>

      <ThemedText type="h3" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
        {description}
      </ThemedText>

      {!isSuccess && consequences.length > 0 ? (
        <>
          <View
            style={[
              styles.infoPanel,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <ThemedText type="small" style={styles.panelTitle}>
              {consequenceTitle}
            </ThemedText>
            {consequences.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Feather name="arrow-right" size={14} color={accentColor} />
                <ThemedText
                  style={[styles.bulletText, { color: theme.textSecondary }]}
                >
                  {item}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.acknowledgementSection}>
            {acknowledgements.map((item) => {
              const checked = checkedAcknowledgements.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.acknowledgementRow,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: checked ? accentColor : theme.glassBorder,
                    },
                  ]}
                  onPress={() => onToggleAcknowledgement(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: checked ? accentColor : theme.glassBorderLight,
                        backgroundColor: checked ? accentColor : "transparent",
                      },
                    ]}
                  >
                    {checked ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                  <ThemedText
                    style={[
                      styles.acknowledgementText,
                      { color: theme.text },
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {errorMessage ? (
        <View style={[styles.errorBanner, { backgroundColor: `${theme.error}1A` }]}>
          <Feather name="alert-circle" size={16} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}
    </AppModalSurface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  infoPanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  panelTitle: {
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  acknowledgementSection: {
    gap: Spacing.sm,
  },
  acknowledgementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acknowledgementText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonGroup: {
    gap: Spacing.sm,
  },
  secondaryButton: {
    width: "100%",
  },
  primaryButton: {
    width: "100%",
  },
});
