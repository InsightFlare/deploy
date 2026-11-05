import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["en", "zh", "zh-tw", "ja"];
const dictionaries = {};
for (const locale of locales) {
  const input = await readFile(resolve(root, "src/i18n", locale + ".yaml"), "utf8");
  const doc = YAML.parseDocument(input, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(locale + ": " + doc.errors.join("; "));
  const dictionary = doc.toJS();
  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) {
    throw new Error(locale + " must contain a flat mapping");
  }
  if (Object.values(dictionary).some((value) => typeof value !== "string")) {
    throw new Error(locale + " translations must all be strings");
  }
  dictionaries[locale] = dictionary;
}
const base = Object.keys(dictionaries.en).sort();
for (const locale of locales) {
  const keys = Object.keys(dictionaries[locale]).sort();
  if (JSON.stringify(keys) !== JSON.stringify(base)) throw new Error(locale + " has missing/extra translation keys");
  for (const key of keys) {
    if (!dictionaries[locale][key].trim()) throw new Error(locale + " / " + key + " is empty");
    const params = (value) => [...value.matchAll(/\{([a-zA-Z_]+)\}/g)].map(match => match[1]).sort();
    if (JSON.stringify(params(dictionaries[locale][key])) !== JSON.stringify(params(dictionaries.en[key])))
      throw new Error(locale + " / " + key + " has invalid interpolation parameters");
  }
}
const serialized = "// Generated from src/i18n/*.yaml. Run pnpm i18n:generate.\n" +
  'export const messages = ' + JSON.stringify(dictionaries, null, 2) +
  ' as const;\nexport type MessageKey = keyof typeof messages.en;\n';
const path = resolve(root, "src/client/i18n.generated.ts");
if (process.argv.includes("--check")) {
  const existing = await readFile(path, "utf8").catch(() => "");
  if (existing !== serialized) throw new Error("Translations are out of date. Run pnpm i18n:generate.");
  console.log("Translation catalogs verified:", base.length, "keys ×", locales.length, "locales");
} else {
  await writeFile(path, serialized);
  console.log("Generated", base.length, "keys ×", locales.length, "locales");
}
