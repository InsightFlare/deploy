import { localeFromPath, localeHref } from "../lib/i18n/page-request";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeToHtmlLang, type Locale } from "../lib/i18n/config";
import { getMessages } from "../lib/i18n/messages";

export { SUPPORTED_LOCALES };
export type { Locale };
export function pageLocale():Locale{
  if(typeof window==="undefined")return DEFAULT_LOCALE;
  return localeFromPath(window.location.pathname)??DEFAULT_LOCALE;
}
export function pageMessages() {
  const locale=pageLocale();
  if(typeof document!=="undefined")document.documentElement.lang=localeToHtmlLang(locale);
  return {locale,messages:getMessages(locale),hrefForLocale:(target:Locale)=>localeHref(target,typeof window==="undefined"?"":window.location.search)};
}
