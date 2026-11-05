import { describe, expect, it } from "vitest";
import { getMessages } from "../src/lib/i18n/messages";
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale, SUPPORTED_LOCALES, localeToHtmlLang } from "../src/lib/i18n/config";
import { nativeLocaleName } from "../src/lib/i18n/native-locale-names";
import { formatI18nTemplate } from "../src/lib/i18n/template";
import { localeFromPath, localeHref, requestLocale, localeCookie } from "../src/lib/i18n/page-request";

describe("InsightFlare-compatible Deploy internationalization", () => {
  it("uses the actual InsightFlare locales, cookie and strict locale resolution", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en","zh","zh-tw","ja"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_COOKIE).toBe("if_locale");
    expect(resolveLocale("zh")).toBe("zh");
    expect(resolveLocale("zh-tw")).toBe("zh-tw");
    expect(resolveLocale("fr")).toBe("en");
    expect(localeToHtmlLang("zh")).toBe("zh-CN");
    expect(nativeLocaleName("ja")).toBe("日本語");
  });
  it("builds fully typed message dictionaries and uses shared template formatting", () => {
    const keys=Object.keys(getMessages("en").deploy);
    for (const locale of SUPPORTED_LOCALES) expect(Object.keys(getMessages(locale).deploy)).toEqual(keys);
    expect(formatI18nTemplate(getMessages("zh").deploy.d1Progress,{applied:3,remaining:2})).toContain("3");
    expect(formatI18nTemplate(getMessages("ja").deploy.stepCount,{current:2,total:6})).toContain("6");
  });
  it("keeps language in the path and uses InsightFlare middleware cookie preference", () => {
    expect(localeFromPath("/zh-tw")).toBe("zh-tw");
    expect(localeFromPath("/ja/")).toBe("ja");
    expect(localeFromPath("/api/v1/health")).toBeNull();
    expect(localeHref("zh","?error=expired")).toBe("/zh?error=expired");
    expect(localeCookie("zh")).toContain("if_locale=zh; Path=/");
    const request=(headers:Record<string,string>)=>new Request("https://deploy.insightflare.net/",{headers});
    expect(requestLocale(request({"accept-language":"zh-Hant-TW,zh;q=0.9,en;q=0.8"}))).toBe("zh-tw");
    expect(requestLocale(request({"cookie":"if_locale=ja"}))).toBe("ja");
    expect(requestLocale(request({"accept-language":"en-US,en;q=0.9","cookie":"if_locale=zh"}))).toBe("en");
  });
});
