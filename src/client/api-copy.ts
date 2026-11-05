import type { Locale } from "../lib/i18n/config";
import type { DeployMessageKey } from "../lib/i18n/messages";
import { getMessages } from "../lib/i18n/messages";
import { formatI18nTemplate } from "../lib/i18n/template";
const COPIES: Record<string, DeployMessageKey> = {
  "Revalidate OAuth account and ownership": "apiPlan1",
  "Resolve and pin a single immutable source commit": "apiPlan2",
  "Download and verify the SHA-pinned official Nightly tar.gz": "apiPlan3",
  "Review and apply compatible forward-only D1 migrations": "apiPlan4",
  "Reconcile resources and upload Worker modules and assets": "apiPlan5",
  "Preserve all existing secrets, domain routes and user data": "apiPlan6",
  "Verify health and record the deployed commit SHA": "apiPlan7",
  "Existing Worker upgrades are available through the D1 migration and Worker Versions panels; new-install resource provisioning and one-click full deployment plans are not enabled.": "apiBlocker1",
  "Worker name is occupied by an unknown application. Automatic takeover is forbidden.": "apiBlocker2",
  "Existing legacy instance must complete an explicit adoption flow.": "apiBlocker3",
  "An existing Worker must be reviewed before installation.": "apiBlocker4",
  "Nothing is installed in this account.": "apiBlocker5",
  "Repair requires a known managed deployment SHA.": "apiBlocker6",
  "Worker identity or deployment marker cannot be verified. Refusing automatic takeover.": "apiIssue1",
  "Existing InsightFlare Worker has no managed deployment SHA; a safe adoption process is required.": "apiIssue2",
  "No standard Worker was returned by Cloudflare. Check that the authorization can list Workers before starting a new installation.": "apiIssue3",
  "Worker ownership must be established before handling this resource.": "resourceUnknownOwnership",
  "This binding has an unexpected type, identifier, or duplicate name. Manual review required.": "resourceUnexpectedBinding",
  "Existing instance lacks this required binding; automatic replacement is forbidden.": "resourceExistingRequired",
  "Preserve existing secret metadata without reading, replacing or rotating its value.": "resourceKeepSecret",
  "Create an isolated D1 database and apply reviewed schema migrations.": "resourceCreateD1",
  "Retain this exact D1 database ID and its existing contents.": "resourceKeepD1",
  "Create a KV namespace for site settings.": "resourceCreateKv",
  "Retain this exact KV namespace and all stored site settings.": "resourceKeepKv",
  "Create the IngestDurableObject SQLite namespace using the reviewed Worker migration.": "resourceCreateDo",
  "Preserve the existing Durable Object namespace and all actor state.": "resourceKeepDo",
  "Generate a new cryptographically random secret; never send it to the browser.": "resourceCreateSecret",
  "Keep the existing secret binding without retrieving or rotating its value.": "resourceKeepRootSecret",
};
const BUILD_STATUS: Record<string,DeployMessageKey> = {"not-installed":"stateNotInstalled","missing-worker-tag":"stateMissingWorkerTag","permission-required":"statePermissionRequired","not-configured":"stateNotConfigured","repository-mismatch":"stateRepositoryMismatch","unsafe-trigger":"stateUnsafeTrigger","candidate":"stateCandidate"};
export function localizeApiCopy(locale:Locale,value:string):string {
  const key=COPIES[value];
  const template=key ? getMessages(locale).deploy[key] : undefined;
  if(template)return template;
  const missing=value.match(/^Required binding (\S+) is missing; cannot safely update\.$/);
  if(missing)return formatI18nTemplate(getMessages(locale).deploy.requiredBindingMissing,{name:missing[1]??""});
  return value;
}
export function localizeBuildStatus(locale:Locale,status:string):string {
  const key=BUILD_STATUS[status];
  return key?getMessages(locale).deploy[key]:status.replaceAll("-"," ");
}
export function localizeResourceDisposition(locale:Locale,disposition:string):string {
  const key=({create:"resourceCreate",preserve:"resourcePreserve",block:"resourceBlock",optional:"resourceOptional"} as Record<string,DeployMessageKey>)[disposition];
  return key?getMessages(locale).deploy[key]:disposition;
}
