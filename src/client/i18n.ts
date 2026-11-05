import { useEffect, useState } from "react";
import { messages, type MessageKey } from "./i18n.generated";

export const SUPPORTED_LOCALES = ["en", "zh", "zh-tw", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "if_locale";

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const normalized = value.toLowerCase().replace("_", "-");
  if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-hant" || normalized.startsWith("zh-hant-")) return "zh-tw";
  if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-hans")) return "zh";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return DEFAULT_LOCALE;
}

export function detectLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const cookie = document.cookie.split("; ").find(part => part.startsWith(LOCALE_COOKIE + "="))?.split("=")[1];
  if (cookie && SUPPORTED_LOCALES.includes(cookie as Locale)) return cookie as Locale;
  if (typeof navigator !== "undefined") {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const language of languages) {
      if (language && /^(en|zh|ja)(-|$)/i.test(language)) return resolveLocale(language);
    }
  }
  return DEFAULT_LOCALE;
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const template: string = messages[locale][key];
  return params ? template.replace(/\{(\w+)\}/g, (full, name: string) => params[name] == null ? full : String(params[name])) : template;
}

export function useDeployLocale() {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale === "zh-tw" ? "zh-TW" : locale;
    document.cookie = LOCALE_COOKIE + "=" + locale + "; Path=/; SameSite=Lax; Max-Age=31536000" + (location.protocol === "https:" ? "; Secure" : "");
  }, [locale]);
  return { locale, setLocale, t: (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params) };
}
