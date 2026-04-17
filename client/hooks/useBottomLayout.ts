import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Configuration options for {@link useBottomLayout}.
 */
type UseBottomLayoutOptions = {
  underTabs?: boolean;
  footerHeight?: number;
  footerSpacing?: number;
  extraContentPadding?: number;
  anchorSpacing?: number;
};

/**
 * React hook that computes bottom-edge layout insets accounting for tab bars,
 * safe areas, and optional footer elements. Use this to correctly position
 * content and floating action buttons above the bottom chrome.
 *
 * @param options - Layout configuration overrides
 * @param options.underTabs - Whether the screen renders beneath the tab bar. Auto-detected when omitted.
 * @param options.footerHeight - Height (px) of a sticky footer element (default 0)
 * @param options.footerSpacing - Additional spacing between footer and content (default 0)
 * @param options.extraContentPadding - Extra bottom padding for the scrollable content area (default 0)
 * @param options.anchorSpacing - Extra spacing for a bottom-anchored element such as a FAB (default 0)
 * @returns An object with pre-calculated inset values:
 *  - `isUnderTabs` — Whether content sits below the tab bar
 *  - `safeAreaBottom` — Raw safe-area bottom inset
 *  - `tabBarHeight` — Height of the bottom tab bar (0 if none)
 *  - `baseBottomInset` — The primary bottom inset (tab bar or safe area)
 *  - `contentBottomInset` — Total bottom padding for scrollable content
 *  - `scrollIndicatorBottomInset` — Inset for the scroll indicator
 *  - `bottomAnchorOffset` — Offset for a floating element anchored at the bottom
 */
export function useBottomLayout({
  underTabs,
  footerHeight = 0,
  footerSpacing = 0,
  extraContentPadding = 0,
  anchorSpacing = 0,
}: UseBottomLayoutOptions = {}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const isUnderTabs = underTabs ?? tabBarHeight > 0;

  const baseBottomInset = isUnderTabs ? tabBarHeight : insets.bottom;
  const contentBottomInset =
    baseBottomInset + footerHeight + footerSpacing + extraContentPadding;
  const scrollIndicatorBottomInset = baseBottomInset;
  const bottomAnchorOffset = baseBottomInset + anchorSpacing;

  return {
    isUnderTabs,
    safeAreaBottom: insets.bottom,
    tabBarHeight,
    baseBottomInset,
    contentBottomInset,
    scrollIndicatorBottomInset,
    bottomAnchorOffset,
  };
}
