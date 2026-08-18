import { en, type MessageKey } from "./en";
import { zh } from "./zh";

export type Locale = "en" | "zh";
export type { MessageKey };

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, zh };

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string>,
): string {
  let value = catalogs[locale][key] ?? catalogs.en[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${name}\\}`, "g"), replacement);
    }
  }
  return value;
}

export function detectSystemLocale(): Locale {
  const language = navigator.language.toLowerCase();
  return language.startsWith("zh") ? "zh" : "en";
}
