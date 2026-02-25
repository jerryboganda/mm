export interface NormalizedMcqOption {
  label: string;
  text: string;
}

const FALLBACK_LABELS = ["A", "B", "C", "D", "E", "F"];

/**
 * Normalize MCQ options from various DB formats into a consistent shape.
 * Handles:
 * - Flat string array: ["text1", "text2", ...]
 * - Keyed object: { "A": "text", "B": "text", ... }
 * - Already normalized: [{ label: "A", text: "..." }, ...]
 */
export function normalizeOptions(rawOptions: unknown): NormalizedMcqOption[] {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((opt, i) => {
      const fallbackLabel = FALLBACK_LABELS[i] || String.fromCharCode(65 + i);

      if (typeof opt === "string") {
        return { label: fallbackLabel, text: opt };
      }

      if (
        typeof opt === "object" &&
        opt !== null &&
        "label" in opt &&
        "text" in opt
      ) {
        return {
          label: String((opt as { label: unknown }).label || fallbackLabel),
          text: String((opt as { text: unknown }).text || ""),
        };
      }

      return {
        label: fallbackLabel,
        text: String(opt ?? ""),
      };
    });
  }

  if (typeof rawOptions === "object" && rawOptions !== null) {
    return Object.entries(rawOptions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, text]) => ({
        label,
        text: String(text ?? ""),
      }));
  }

  return [];
}

/**
 * Resolve a correctAnswer value to an option label.
 * Supports both label-based ("A") and text-based correct answers.
 */
export function resolveCorrectLabel(
  correctAnswer: string,
  rawOptions: unknown,
): string {
  if (/^[A-F]$/i.test(correctAnswer)) return correctAnswer.toUpperCase();

  const normalized = normalizeOptions(rawOptions);
  const normalizedAnswer = String(correctAnswer || "").trim();
  const matched = normalized.find(
    (opt) => opt.text.trim().toLowerCase() === normalizedAnswer.toLowerCase(),
  );
  return matched ? matched.label : correctAnswer;
}

/**
 * Resolve a selected answer value to its option label.
 * Handles both label-based ("A") and text-based payloads.
 */
export function resolveAnswerLabel(
  selectedAnswer: string,
  rawOptions: unknown,
): string {
  const normalized = normalizeOptions(rawOptions);
  const raw = String(selectedAnswer || "").trim();
  if (!raw) return "";

  const byLabel = normalized.find(
    (opt) => opt.label.trim().toUpperCase() === raw.toUpperCase(),
  );
  if (byLabel) return byLabel.label;

  const byText = normalized.find(
    (opt) => opt.text.trim().toLowerCase() === raw.toLowerCase(),
  );
  return byText ? byText.label : raw;
}

/**
 * Get the human-readable option text for a given label.
 */
export function getOptionTextByLabel(
  label: string,
  rawOptions: unknown,
): string {
  const normalized = normalizeOptions(rawOptions);
  const matched = normalized.find((opt) => opt.label === label);
  return matched ? matched.text : label;
}
