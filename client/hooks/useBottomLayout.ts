import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UseBottomLayoutOptions = {
  underTabs?: boolean;
  footerHeight?: number;
  footerSpacing?: number;
  extraContentPadding?: number;
  anchorSpacing?: number;
};

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
