import type { UninstallPlan } from "../core/uninstall";
import { useState } from "react";
import {
  RiCloudLine, RiLogoutBoxRLine, RiExternalLinkLine, RiCheckLine, RiCloseLine, RiLoader4Line,
  RiSubtractLine, RiAlertLine, RiRefreshLine, RiArrowRightLine
} from "@remixicon/react";
import { Button } from "@insightflare/ui/button";
import { Badge } from "@insightflare/ui/badge";
import { Checkbox } from "@insightflare/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@insightflare/ui/select";
import { Separator } from "@insightflare/ui/separator";
import { Input } from "@insightflare/ui/input";
import { Label } from "@insightflare/ui/label";
import { RadioGroup, RadioGroupItem } from "@insightflare/ui/radio-group";
import { AutoResizer } from "@insightflare/ui/auto-resizer";
import { AutoTransition } from "@insightflare/ui/auto-transition";
import type { Account, AccountOverview, PipelineRun, PipelineStep, RunView, Session } from "./api";
import { isHostname } from "../lib/hostname";
import { ANALYTICS_ENGINE_URL, CLOUDFLARE_WORKER_URL, CONNECT_URL } from "./api";
import { ConfirmOperation, CopyValue, Eyebrow, Notice, shortSha, type Translate } from "./ui";
import { trackOAuthStart } from "./analytics";

type TMaybe = (key: string, params?: Record<string, string | number>) => string | null;

/* ------------------------------- Connect ------------------------------- */

/** Shown when the grant lacks API token management: re-authorize, or go on and set the reader up by hand. */
function ReaderScopeNotice({ t }: { t: Translate }) {
  return <Notice tone="warning" title={t("readerScopeMissingTitle")}
    action={<Button variant="outline" asChild><a href={CONNECT_URL} onClick={trackOAuthStart}><RiRefreshLine data-icon="inline-start" />{t("reauthorize")}</a></Button>}>
    {t("readerScopeMissingBody")}
  </Notice>;
}

export function ConnectStep({ t, session, locale, readerMissing }: {
  t: Translate; session: Session; locale: string; readerMissing: boolean;
}) {
  const expires = session.expiresAt
    ? new Date(session.expiresAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
  return <div className="space-y-5">
    <Notice tone="success" title={t("dataPromise")}>{session.connected ? t("connectedDesc", { time: expires }) : t("connectDesc")}</Notice>
    <Notice title={t("permissionsTitle")}>{t("permissionsBody")}</Notice>
    {readerMissing ? <ReaderScopeNotice t={t} /> : null}
    {!session.connected && !session.oauthConfigured ? <Notice tone="warning">{t("oauthMissing")}</Notice> : null}
  </div>;
}

/* ------------------------------- Account ------------------------------- */

const KIND_KEY = {
  "not-installed": "kindNotInstalled", managed: "kindManaged",
  "legacy-candidate": "kindLegacy", conflict: "kindConflict"
} as const;

export function AccountStep({ t, accounts, accountId, onSelect, overview, loading, runView }: {
  t: Translate; accounts: Account[]; accountId: string; onSelect: (id: string) => void;
  overview: AccountOverview | null; loading: boolean; runView: RunView | null;
}) {
  return <div className="space-y-5">
    <div className="space-y-2">
      <Eyebrow>{t("accountLabel")}</Eyebrow>
      <Select value={accountId || undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("accountPlaceholder")} /></SelectTrigger>
        <SelectContent>
          {accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <AutoTransition type="fade" duration={0.18} transitionKey={loading ? "loading" : overview ? overview.deployment.kind + (runView?.run ? ":run" : "") : "none"}>
    {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLoader4Line className="size-4 animate-spin" />{t("discovering")}</p>
    : <div className="space-y-5">
    {overview ? <div className="flex flex-wrap items-center gap-2 border border-border p-4 text-sm">
      <Badge variant={overview.deployment.kind === "conflict" ? "destructive" : overview.deployment.kind === "not-installed" ? "outline" : "secondary"}>
        {t(KIND_KEY[overview.deployment.kind])}
      </Badge>
      <span className="deploy-mono text-xs text-muted-foreground">{overview.deployment.workerName}</span>
      {overview.deployment.deployedSha
        ? <span className="deploy-mono text-xs text-muted-foreground">· {t("deployedCommit", { sha: shortSha(overview.deployment.deployedSha) })}</span> : null}
    </div> : null}
    {runView?.run ? <Notice>{t("resumeRun")}</Notice> : null}
    </div>}
    </AutoTransition>
  </div>;
}

/* -------------------------------- Review ------------------------------- */

function PlanList({ items }: { items: Array<string | null | false> }) {
  return <ul className="space-y-2">
    {items.filter(Boolean).map((item, i) => <li key={i} className="flex gap-2 text-xs leading-5">
      <RiCheckLine className="mt-0.5 size-3.5 shrink-0 text-primary" /><span className="deploy-mono">{item}</span>
    </li>)}
  </ul>;
}

/** Review form state, owned by the shell so the footer can start the run. */
export interface ReviewForm {
  adopt: boolean; setAdopt: (value: boolean) => void;
  passwordMode: "generate" | "custom"; setPasswordMode: (value: "generate" | "custom") => void;
  password: string; setPassword: (value: string) => void;
  repeat: string; setRepeat: (value: string) => void;
  domainMode: "default" | "custom"; setDomainMode: (value: "default" | "custom") => void;
  zoneId: string; setZoneId: (value: string) => void;
  subdomain: string; setSubdomain: (value: string) => void;
}

export function useReviewForm(): ReviewForm {
  const [adopt, setAdopt] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"generate" | "custom">("generate");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [domainMode, setDomainMode] = useState<"default" | "custom">("default");
  const [zoneId, setZoneId] = useState("");
  const [subdomain, setSubdomain] = useState("insight");
  return { adopt, setAdopt, passwordMode, setPasswordMode, password, setPassword, repeat, setRepeat,
    domainMode, setDomainMode, zoneId, setZoneId, subdomain, setSubdomain };
}

export type ReviewMode = "install" | "update" | "configure";

/** What the review step will do, shared by the page and the footer button. */
export function reviewDecision(overview: AccountOverview, readerMissing: boolean, form: ReviewForm) {
  const install = overview.install;
  const update = overview.update;
  const reader = overview.analyticsReader;
  // Custom domain: one of the account's zones plus an optional subdomain.
  const zone = overview.zones?.find(item => item.id === form.zoneId);
  const sub = form.subdomain.trim().toLowerCase();
  const hostname = zone ? (sub ? sub + "." + zone.name : zone.name) : "";
  const domainChosen = form.domainMode === "custom";
  const domainInvalid = domainChosen && (!zone || !isHostname(hostname));
  const domainNew = domainChosen && !domainInvalid && !(overview.customDomains ?? []).includes(hostname);
  // Up to date installations can still switch AE on, configure its reader or add a domain.
  const configureOnly = overview.upToDate && (reader === "missing" || reader === "switched-off" || domainNew);
  // Nothing is uploaded: only the reader and/or the domain are configured.
  const readerOnly = configureOnly && reader !== "switched-off";
  const aeOff = overview.analyticsEngine === "disabled" &&
    (Boolean(install?.analyticsDatasets.length) || reader === "switched-off");
  // The run would create the reader token, but the grant cannot.
  const readerAffected = readerMissing && !aeOff &&
    (configureOnly || reader === "missing" || reader === "switched-off" || Boolean(install?.analyticsDatasets.length));
  const custom = form.passwordMode === "custom";
  const passwordProblem = !install || !custom ? null
    : form.password.length < 8 || form.password.length > 128 ? "adminPasswordTooShort" as const
    : form.password !== form.repeat ? "adminPasswordMismatch" as const : null;
  const needsAdoption = Boolean(update?.legacyAdoptionRequired);
  const mode: ReviewMode | null = install ? "install" : update ? (readerOnly ? "configure" : "update") : null;
  const available = Boolean(mode) && (!overview.upToDate || configureOnly);
  const blocked = overview.blockers.length > 0 || !overview.release || !available ||
    // Reader-only configuration without the permission to create the token does nothing.
    (readerOnly && readerMissing && !domainNew) ||
    // Switching Analytics Engine on cannot work until the account has enabled it.
    (configureOnly && reader === "switched-off" && overview.analyticsEngine === "disabled") ||
    (needsAdoption && !form.adopt) || Boolean(passwordProblem) || domainInvalid;
  return { install, update, reader, configureOnly, readerOnly, aeOff, readerAffected, custom, passwordProblem,
    needsAdoption, mode, available, blocked, hasMigrations: Boolean(update?.pendingMigrations),
    hostname, domainChosen, domainInvalid, domainNew, readerConfigures: configureOnly && (reader === "missing" || reader === "switched-off") };
}

export function ReviewStep({ t, tMaybe, overview, accountId, readerMissing, form, onRecheck }: {
  t: Translate; tMaybe: TMaybe; overview: AccountOverview; accountId: string; readerMissing: boolean;
  form: ReviewForm; onRecheck: () => void;
}) {
  const d = reviewDecision(overview, readerMissing, form);
  const { install, update, reader } = d;
  const readerPlanned = !readerMissing;
  return <div className="space-y-6">
    {overview.source ? <div className="space-y-1.5">
      <Eyebrow>{t("sourceCommit")}</Eyebrow>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="deploy-mono font-semibold">{overview.source.shortSha}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{overview.source.message.split("\n")[0]}</span>
        <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={overview.source.url} target="_blank" rel="noreferrer">
          {t("viewCommit")}<RiExternalLinkLine className="size-3" />
        </a>
      </div>
    </div> : null}

    {overview.blockers.length ? <Notice tone="error" title={t("blockersTitle")}>
      <ul className="space-y-1">{overview.blockers.map(blocker =>
        <li key={blocker.code}>{tMaybe("blocker_" + blocker.code) ?? blocker.message}</li>)}</ul>
    </Notice> : null}

    {overview.upToDate ? <Notice tone="success">{t(!d.configureOnly ? "upToDate" : reader === "switched-off" ? "upToDateAeOff" : "upToDateReaderMissing")}</Notice> : null}
    {reader ? <p className="text-xs text-muted-foreground">{t("aeStatusLabel")} · <span className="text-foreground">{tMaybe("aeStatus_" + reader.replace("-", "_"))}</span></p> : null}
    {d.aeOff ? <Notice tone="warning" title={t("aeDisabledTitle")} action={<div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild><a href={ANALYTICS_ENGINE_URL(accountId)} target="_blank" rel="noreferrer"><RiExternalLinkLine data-icon="inline-start" />{t("enableAnalyticsEngine")}</a></Button>
      <Button variant="outline" onClick={onRecheck}><RiRefreshLine data-icon="inline-start" />{t("recheck")}</Button>
    </div>}>{t(install ? "aeDisabledInstallBody" : "aeDisabledUpdateBody")}</Notice> : null}
    {d.readerAffected ? <ReaderScopeNotice t={t} /> : null}

    {install ? <div className="space-y-3">
      <Eyebrow>{t("installPlanTitle")}</Eyebrow>
      <PlanList items={[
        t("planWorker", { name: install.workerName }),
        t(install.database.action === "create" ? "planDatabaseCreate" : "planDatabaseReuse", { name: install.database.name }),
        t(install.kvNamespace.action === "create" ? "planKvCreate" : "planKvReuse", { name: install.kvNamespace.name }),
        t("planMigrations", { count: install.migrations }),
        install.crons.length ? t("planCrons", { list: install.crons.join(", ") }) : null,
        t("planSecrets"),
        install.analyticsDatasets.length && !d.aeOff ? t("planAnalytics") : null,
        install.analyticsDatasets.length && !d.aeOff && readerPlanned ? t("planAnalyticsReader") : null,
        d.domainNew ? t("planDomain", { host: d.hostname }) : null,
        install.workersDevSubdomain ? t("planUrl", { url: `https://${install.workerName}.${install.workersDevSubdomain}.workers.dev` }) : null
      ]} />
      {!install.workersDevSubdomain ? <Notice tone="warning">{t("planNoWorkersDev")}</Notice> : null}
      <div className="space-y-3 border border-border p-4">
        <Eyebrow>{t("adminPasswordTitle")}</Eyebrow>
        <RadioGroup value={form.passwordMode} onValueChange={value => form.setPasswordMode(value === "custom" ? "custom" : "generate")} className="gap-2">
          <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="generate" />{t("adminPasswordGenerate")}</label>
          <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="custom" />{t("adminPasswordCustom")}</label>
        </RadioGroup>
        <AutoResizer duration={0.2}>
        <AutoTransition type="fade" duration={0.16} transitionKey={form.passwordMode}>
        {d.custom ? <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">{t("adminPasswordLabel")}</Label>
            <Input id="admin-password" type="password" autoComplete="new-password" value={form.password} onChange={event => form.setPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password-repeat">{t("adminPasswordRepeat")}</Label>
            <Input id="admin-password-repeat" type="password" autoComplete="new-password" value={form.repeat} onChange={event => form.setRepeat(event.target.value)} />
          </div>
          <AutoTransition className="sm:col-span-2" type="fade" duration={0.14}
            transitionKey={d.passwordProblem && (form.password || form.repeat) ? d.passwordProblem : "hint"}>
            <p className={"text-xs " + (d.passwordProblem && (form.password || form.repeat) ? "text-destructive" : "text-muted-foreground")}>
              {d.passwordProblem && (form.password || form.repeat) ? t(d.passwordProblem) : t("adminPasswordHint")}
            </p>
          </AutoTransition>
        </div> : <span />}
        </AutoTransition>
        </AutoResizer>
      </div>
    </div> : null}

    {(install || update) && overview.release && !overview.blockers.length
      ? <DomainSection t={t} overview={overview} form={form} hostname={d.hostname} invalid={d.domainInvalid} /> : null}

    {update && (d.available || d.domainNew) ? <div className="space-y-3">
      <Eyebrow>{t("updatePlanTitle")}</Eyebrow>
      <PlanList items={d.configureOnly ? [
        reader === "switched-off" ? t("planEnableAnalytics") : null,
        d.readerConfigures && readerPlanned ? t("planAnalyticsReader") : null,
        d.domainNew ? t("planDomain", { host: d.hostname }) : null
      ] : [
        t("updateFromTo", { from: shortSha(update.fromSha) || t("unknownVersion"), to: shortSha(overview.release?.sha) }),
        update.pendingMigrations ? t("updatePendingMigrations", { count: update.pendingMigrations }) : t("updateNoMigrations"),
        update.durableObjectMigration ? t("updateDoMigration") : null,
        reader === "switched-off" ? t("planEnableAnalytics") : null,
        (reader === "missing" || reader === "switched-off") && readerPlanned ? t("planAnalyticsReader") : null,
        d.domainNew ? t("planDomain", { host: d.hostname }) : null
      ]} />
      {update.destructiveMigrations ? <Notice tone="warning">{t("updateDestructive")}</Notice> : null}
      <Notice>{t(d.readerOnly ? "updateSafetyConfigure" : "updateSafety")}</Notice>
      {d.needsAdoption ? <label className="flex items-start gap-3 border border-border p-4 text-xs leading-5">
        <Checkbox checked={form.adopt} onCheckedChange={value => form.setAdopt(value === true)} className="mt-0.5" />
        <span>{t("legacyAdopt")}</span>
      </label> : null}
    </div> : null}
  </div>;
}

/** Optional custom domain: one of the account's zones plus a subdomain. */
function DomainSection({ t, overview, form, hostname, invalid }: {
  t: Translate; overview: AccountOverview; form: ReviewForm; hostname: string; invalid: boolean;
}) {
  const current = overview.customDomains ?? [];
  const custom = form.domainMode === "custom";
  const zones = overview.zones ?? [];
  if (!zones.length) {
    // Nothing to pick from: say why instead of hiding the option.
    return <div className="space-y-2 border border-border p-4">
      <Eyebrow>{t("domainTitle")}</Eyebrow>
      {current.length ? <p className="text-xs text-muted-foreground">{t("domainCurrent", { list: current.join(", ") })}</p> : null}
      <p className="text-xs leading-5 text-muted-foreground">
        {overview.zonesError ? t("domainZonesError", { error: overview.zonesError }) : t("domainNoZones")}
      </p>
    </div>;
  }
  return <div className="space-y-3 border border-border p-4">
    <Eyebrow>{t("domainTitle")}</Eyebrow>
    {current.length ? <p className="text-xs text-muted-foreground">{t("domainCurrent", { list: current.join(", ") })}</p> : null}
    <RadioGroup value={form.domainMode} onValueChange={value => form.setDomainMode(value === "custom" ? "custom" : "default")} className="gap-2">
      <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="default" />{t(overview.install ? "domainUseWorkersDev" : "domainKeep")}</label>
      <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="custom" />{t(current.length ? "domainAddCustom" : "domainUseCustom")}</label>
    </RadioGroup>
    <AutoResizer duration={0.2}>
    <AutoTransition type="fade" duration={0.16} transitionKey={form.domainMode}>
    {custom ? <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="domain-subdomain">{t("domainSubdomain")}</Label>
        <Input id="domain-subdomain" value={form.subdomain} placeholder="insight" onChange={event => form.setSubdomain(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("domainZone")}</Label>
        <Select value={form.zoneId || undefined} onValueChange={form.setZoneId}>
          <SelectTrigger className="w-full"><SelectValue placeholder={t("domainZonePlaceholder")} /></SelectTrigger>
          <SelectContent>{(overview.zones ?? []).map(zone => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className={"text-xs sm:col-span-2 " + (invalid && form.zoneId ? "text-destructive" : "text-muted-foreground")}>
        {invalid ? (form.zoneId ? t("domainInvalid") : t("domainHint"))
          : current.includes(hostname) ? t("domainAlready", { host: hostname }) : t("domainPreview", { host: hostname })}
      </p>
    </div> : <span />}
    </AutoTransition>
    </AutoResizer>
  </div>;
}

/* -------------------------------- Deploy ------------------------------- */

function StepIcon({ step, active }: { step: PipelineStep; active: boolean }) {
  if (active) return <RiLoader4Line className="size-4 animate-spin text-primary" />;
  switch (step.status) {
    case "done": return <RiCheckLine className="size-4 text-primary" />;
    case "warning": return <RiAlertLine className="size-4 text-amber-600 dark:text-amber-400" />;
    case "failed": return <RiCloseLine className="size-4 text-destructive" />;
    case "skipped": return <RiSubtractLine className="size-4 text-muted-foreground" />;
    default: return <span className="size-1.5 bg-border" />;
  }
}

function noteText(tMaybe: TMaybe, step: PipelineStep): string | null {
  if (!step.note) return null;
  return tMaybe("note_" + step.note.code, step.note.params) ?? null;
}

export function DeployStep({ t, tMaybe, run, otherTab, reconnect, error }: {
  t: Translate; tMaybe: TMaybe; run: PipelineRun; otherTab: boolean; reconnect: boolean;
  error: string;
}) {
  const activeIndex = run.phase === "running" ? run.steps.findIndex(step => step.status === "pending") : -1;
  const STATUS = { pending: "statusPending", done: "statusDone", skipped: "statusSkipped", warning: "statusWarning", failed: "statusFailed" } as const;
  return <div className="space-y-5">
    <ol className="divide-y divide-border border border-border">
      {run.steps.map((step, i) => {
        const active = i === activeIndex;
        const note = noteText(tMaybe, step);
        return <li key={step.id} className="flex items-start gap-3 px-4 py-3" data-active={active}>
          <span className="flex size-5 shrink-0 items-center justify-center">{<StepIcon step={step} active={active} />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={"text-sm " + (active ? "font-semibold" : step.status === "pending" ? "text-muted-foreground" : "")}>
                {tMaybe("runStep_" + step.id) ?? step.id}
              </span>
              <AutoTransition as="span" type="fade" duration={0.16} transitionKey={active ? "running" : step.status}>
                <span className="text-[11px] text-muted-foreground">{t(active ? "statusRunning" : STATUS[step.status])}</span>
              </AutoTransition>
            </div>
            <AutoTransition type="fade" duration={0.16} transitionKey={note ?? ""}>
              {note ? <p className="deploy-mono mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
            </AutoTransition>
            {step.status === "failed" && step.note?.message ? <p className="deploy-mono mt-1 text-xs text-destructive">{step.note.message}</p> : null}
          </div>
        </li>;
      })}
    </ol>
    <AutoTransition type="fade" duration={0.18}
      transitionKey={[run.phase, otherTab, reconnect, error, run.state.rolledBack].join("|")}>
    <div className="space-y-5">
    {run.phase === "running" ? <Notice>{t("deployDesc")}</Notice> : null}
    {otherTab ? <Notice>{t("otherTab")}</Notice> : null}
    {reconnect ? <Notice tone="warning" action={<Button asChild><a href={CONNECT_URL} onClick={trackOAuthStart}>{t("connectButton")}</a></Button>}>{t("reconnectNeeded")}</Notice> : null}
    {error && !reconnect ? <Notice tone="error">{error}</Notice> : null}
    {run.phase === "failed" ? <Notice tone="error" title={t("runFailedTitle")}>
      {run.state.rolledBack ? t("rolledBackDesc") : run.intent === "uninstall" ? t("uninstallFailedDesc") : run.failure?.code === "SOURCE_MOVED" ? t("runSourceMovedDesc") : t("runFailedDesc")}
    </Notice> : null}
    </div>
    </AutoTransition>
  </div>;
}

export function UninstallReview({ t, plan, confirmation, onConfirmation }: {
  t: Translate; plan: UninstallPlan; confirmation: string; onConfirmation(value: string): void;
}) {
  return <div className="space-y-5">
    <Notice tone="error" title={t("uninstallConfirmTitle")}>{t("uninstallWarning")}</Notice>
    <div className="space-y-3 border border-border p-4">
      <Eyebrow>{t("uninstallResources")}</Eyebrow>
      {[
        plan.workerId ? { name: "Worker · insightflare", id: plan.workerId } : null,
        plan.database ? { name: "D1 · " + plan.database.name, id: plan.database.id } : null,
        plan.kv ? { name: "KV · " + plan.kv.name, id: plan.kv.id } : null,
        ...plan.domains.map(host => ({ name: host, id: t("runStep_domain") }))
      ].filter(item => item !== null).map(item => <div key={item.id + item.name} className="space-y-1 border-b border-border/70 pb-2 last:border-0 last:pb-0">
        <p className="text-sm font-medium">{item.name}</p><p className="break-all text-xs text-muted-foreground">{item.id}</p>
      </div>)}
    </div>
    <Notice tone="warning">{t("uninstallResidual")}</Notice>
    <div className="space-y-2">
      <Label htmlFor="uninstall-confirm">{t("uninstallTypeName")}</Label>
      <Input id="uninstall-confirm" value={confirmation} onChange={event => onConfirmation(event.target.value)} placeholder="insightflare" autoComplete="off" spellCheck={false} />
    </div>
  </div>;
}

/* --------------------------------- Done -------------------------------- */

export function DoneStep({ t, run, admin, accountId }: {
  t: Translate; run: PipelineRun; admin: RunView["admin"]; accountId: string;
}) {
  if (run.intent === "uninstall") return <div className="space-y-5"><Notice tone="success">{t("uninstallDoneDesc")}</Notice><Notice tone="warning">{t("uninstallResidual")}</Notice></div>;
  // A custom domain is the address users will keep; workers.dev stays as a fallback.
  const url = run.state.customUrl ?? run.state.workerUrl ?? null;
  const step = (id: string) => run.steps.find(item => item.id === id);
  const followUps: Array<{ text: string; href: string; label: string }> = [];
  if (run.state.analyticsEngine === "disabled") {
    followUps.push({ text: t("followAeEnable"), href: ANALYTICS_ENGINE_URL(accountId), label: t("enableAnalyticsEngine") });
  }
  if (["AE_READER_MANUAL", "AE_READER_NOT_AUTHORIZED"].includes(step("analytics")?.note?.code ?? "")) {
    followUps.push({ text: t("followAeReader"), href: url ? url + "/" : CLOUDFLARE_WORKER_URL(accountId), label: url ? t("openDashboard") : t("openCloudflare") });
  }
  if (step("subdomain")?.note?.code === "WORKERS_DEV_MISSING") {
    followUps.push({ text: t("followWorkersDev"), href: CLOUDFLARE_WORKER_URL(accountId), label: t("openCloudflare") });
  }
  const domainStep = step("domain");
  if (domainStep?.note?.code === "DOMAIN_FAILED") {
    followUps.push({ text: t("followDomain", { host: String(domainStep.note.params?.host ?? "") }), href: CLOUDFLARE_WORKER_URL(accountId), label: t("openCloudflare") });
  }
  if (step("health")?.note?.code === "HEALTH_TIMEOUT") {
    followUps.push({ text: t("followHealth"), href: url ?? CLOUDFLARE_WORKER_URL(accountId), label: t("openDashboard") });
  }
  return <div className="space-y-6">
    <Notice tone="success"
      action={url ? <Button asChild><a href={url} target="_blank" rel="noreferrer"><RiExternalLinkLine data-icon="inline-start" />{t("openDashboard")}</a></Button> : undefined}>
      {t("doneDesc", { sha: shortSha(run.sourceSha) })}
      {url ? <span className="deploy-mono block pt-1">{url}</span> : null}
    </Notice>

    <AutoTransition type="fade" duration={0.18} transitionKey={admin?.password ? "shown" : "hidden"}>
    {run.intent === "install" ? <div className="space-y-4 border border-border p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t("adminTitle")}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {admin?.password ? t("adminDesc") : run.customAdminPassword ? t("adminCustomDesc") : t("passwordForgotten")}
        </p>
      </div>
      {run.customAdminPassword ? <CopyValue label={t("username")} value="admin" t={t} /> : null}
      {admin?.password ? <>
        <CopyValue label={t("username")} value={admin.username} t={t} />
        <CopyValue label={t("password")} value={admin.password} t={t} />
      </> : null}
    </div> : <span />}
    </AutoTransition>

    {followUps.length ? <div className="space-y-3">
      <Eyebrow>{t("followUpTitle")}</Eyebrow>
      {followUps.map(item => <Notice key={item.text} tone="warning" action={
        <Button variant="outline" asChild><a href={item.href} target="_blank" rel="noreferrer"><RiExternalLinkLine data-icon="inline-start" />{item.label}</a></Button>}>
        {item.text}
      </Notice>)}
    </div> : null}

  </div>;
}
