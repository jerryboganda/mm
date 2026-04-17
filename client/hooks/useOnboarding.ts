import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_COMPLETE_KEY = "@maternal_mind_onboarding_complete";

/**
 * React hook that manages the user's onboarding completion state.
 * Persists the flag to AsyncStorage so it survives app restarts.
 *
 * @returns An object containing:
 *  - `hasCompletedOnboarding` — Whether the user has finished onboarding (null while loading)
 *  - `isLoading` — Whether the onboarding status is still being loaded from storage
 *  - `completeOnboarding` — Async function to mark onboarding as done
 *  - `resetOnboarding` — Async function to clear the onboarding flag (for testing/debug)
 */
export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setHasCompletedOnboarding(value === "true");
    } catch (error) {
      setHasCompletedOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      setHasCompletedOnboarding(true);
    } catch (error) {}
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setHasCompletedOnboarding(false);
    } catch (error) {}
  };

  return {
    hasCompletedOnboarding,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  };
}
