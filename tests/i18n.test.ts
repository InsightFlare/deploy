import { describe, expect, it } from "vitest";
import { messages } from "../src/client/i18n.generated";
import { resolveLocale, translate } from "../src/client/i18n";

describe("Deploy internationalization", () => {
  it("supports the same four locales as InsightFlare", () => {
    expect(Object.keys(messages)).toEqual(["en", "zh", "zh-tw", "ja"]);
    expect(resolveLocale("zh-Hant-TW")).toBe("zh-tw");
    expect(resolveLocale("zh-CN")).toBe("zh");
    expect(resolveLocale("ja-JP")).toBe("ja");
    expect(resolveLocale("fr")).toBe("en");
  });
  it("has all keys in each locale and interpolates safely", () => {
    const keys = Object.keys(messages.en);
    for (const dictionary of Object.values(messages)) expect(Object.keys(dictionary)).toEqual(keys);
    expect(translate("zh", "d1Progress", {applied: 3, remaining: 2})).toContain("3");
    expect(translate("ja", "stepCount", {current: 2, total: 6})).toContain("6");
  });
});
