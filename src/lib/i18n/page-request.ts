import { DEFAULT_LOCALE, isValidLocale, LOCALE_COOKIE, type Locale } from "./config";

const COOKIE_MAX_AGE=60*60*24*365;
export const LOCALE_PATHS = ["/en","/zh","/zh-tw","/ja"] as const;

export function localeFromPath(pathname:string):Locale|null {
  const fragment=pathname.split("/")[1];
  return isValidLocale(fragment)?fragment:null;
}
export function localeCookie(locale:Locale):string {
  return LOCALE_COOKIE+"="+encodeURIComponent(locale)+"; Path=/; Max-Age="+COOKIE_MAX_AGE+"; SameSite=Lax";
}
function cookieValue(request:Request,name:string):string {
  const header=request.headers.get("cookie")||"";
  for(const item of header.split(";")){
    const [key,...value]=item.trim().split("=");
    if(key===name){
      try{return decodeURIComponent(value.join("="));}catch{return value.join("=");}
    }
  }
  return "";
}
// The resolution order is the same as InsightFlare middleware: request language,
// then persisted cookie, then the default en.
export function requestLocale(request:Request):Locale {
  const accept=request.headers.get("accept-language");
  if(accept){
    const preferred=accept.split(",").map(part=>part.trim().split(";")[0]!.trim().toLowerCase())
      .map(tag=>{
        if(tag==="zh-tw"||tag==="zh-hk"||tag==="zh-mo"||tag.startsWith("zh-hant"))return "zh-tw";
        return isValidLocale(tag)?tag:tag.slice(0,2);
      }).find(isValidLocale);
    if(preferred)return preferred;
  }
  const stored=cookieValue(request,LOCALE_COOKIE);
  return isValidLocale(stored)?stored:DEFAULT_LOCALE;
}
export function localeHref(locale:Locale,search=""):string {
  return "/"+locale+(search.startsWith("?")?search:"");
}
