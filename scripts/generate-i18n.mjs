import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["en", "zh", "zh-tw", "ja"];
const documents = {};

function visit(value, path="", leaf=new Map(), nodes=new Map()) {
  if (value && typeof value==="object" && !Array.isArray(value)) {
    if (path) nodes.set(path,"object");
    for (const [key, child] of Object.entries(value)) visit(child,path?path+"."+key:key,leaf,nodes);
  } else {
    if (typeof value!=="string" || !value.trim()) throw new Error("Invalid/empty translation: "+path);
    leaf.set(path,value);
    nodes.set(path,"string");
  }
  return {leaf,nodes};
}
function vars(value) {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(v=>v[1]).sort().join(",");
}
for(const locale of LOCALES){
  const input=await readFile(resolve(ROOT,"src/i18n",locale+".yaml"),"utf8");
  const doc=YAML.parseDocument(input,{uniqueKeys:true});
  if(doc.errors.length) throw new Error(locale+": "+doc.errors.join("; "));
  const parsed=doc.toJS();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||!parsed.deploy || !Object.keys(parsed).every(k=>k==="deploy"))
    throw new Error(locale+" must have the deploy namespace");
  documents[locale]=parsed;
}
const baseline=visit(documents.en);
for(const locale of LOCALES.slice(1)){
  const other=visit(documents[locale]);
  const all=new Set([...baseline.nodes.keys(),...other.nodes.keys()]);
  for(const key of all) {
    if(baseline.nodes.get(key)!==other.nodes.get(key))throw new Error(locale+" mismatched message node "+key);
    if(baseline.leaf.has(key) && vars(baseline.leaf.get(key))!==vars(other.leaf.get(key)))
      throw new Error(locale+" mismatched template variables "+key);
  }
}
function tsType(value,depth=1){
  const pad="  ".repeat(depth);
  return "{\n"+Object.entries(value).map(([key,v])=>pad+JSON.stringify(key)+": "+(typeof v==="string"?"string":tsType(v,depth+1))+";").join("\n")+"\n"+"  ".repeat(depth-1)+"}";
}
const output=[
  "// @generated from src/i18n/*.yaml by scripts/generate-i18n.mjs.",
  'import type { Locale } from "./config";',
  "",
  "export interface AppMessages "+tsType(documents.en,1)+";",
  ...LOCALES.map(locale=>"const "+locale.replaceAll("-","_")+"Messages: AppMessages = "+JSON.stringify(documents[locale],null,2)+";"),
  "const DICTIONARIES: Record<Locale,AppMessages> = {",
  ...LOCALES.map(locale=>"  "+JSON.stringify(locale)+": "+locale.replaceAll("-","_")+"Messages,"),
  "};",
  "export function getMessages(locale: Locale): AppMessages { return DICTIONARIES[locale]; }",
  'export type DeployMessageKey = keyof AppMessages["deploy"];',
  ""
].join("\n");
const out=resolve(ROOT,"src/lib/i18n/messages.ts");
if(process.argv.includes("--check")){
  const existing=await readFile(out,"utf8").catch(()=>"");
  if(existing!==output)throw new Error("i18n generated file is stale, run pnpm i18n:generate");
  console.log("Validated InsightFlare-style AppMessages: "+baseline.leaf.size+" leaves × "+LOCALES.length+" locales");
}else{
  await writeFile(out,output);
  console.log("Generated InsightFlare-style AppMessages: "+baseline.leaf.size+" leaves × "+LOCALES.length+" locales");
}
