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
import type { Account, AccountOverview, PipelineRun, PipelineStep, RunView, Session } from "./api";
import { ANALYTICS_ENGINE_URL, CLOUDFLARE_WORKER_URL, CONNECT_URL } from "./api";
import { ConfirmOperation, CopyValue, Eyebrow, Notice, shortSha, type Translate } from "./ui";

type TMaybe = (key: string, params?: Record<string, string | number>) => string | null;

/* ------------------------------- Connect ------------------------------- */

export function ConnectStep({ t, session, locale, onDisconnect }: {
  t: Translate; session: Session; locale: string; onDisconnect: () => void;
}) {
  const expires = session.expiresAt
    ? new Date(session.expiresAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
  return <div className="space-y-5">
    <Notice tone="success" title={t("dataPromise")}>{session.connected ? t("connectedDesc", { time: expires }) : t("connectDesc")}</Notice>
    <Notice title={t("permissionsTitle")}>{t("permissionsBody")}</Notice>
    <div className="flex flex-wrap items-center gap-3">
      {session.connected
        ? <Button variant="outline" onClick={onDisconnect}><RiLogoutBoxRLine data-icon="inline-start" />{t("disconnect")}</Button>
        : session.oauthConfigured
          ? <Button asChild><a href={CONNECT_URL}><RiCloudLine data-icon="inline-start" />{t("connectButton")}</a></Button>
          : <Notice tone="warning">{t("oauthMissing")}</Notice>}
    </div>
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
    {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLoader4Line className="size-4 animate-spin" />{t("discovering")}</p> : null}
    {overview && !loading ? <div className="flex flex-wrap items-center gap-2 border border-border p-4 text-sm">
      <Badge variant={overview.deployment.kind === "conflict" ? "destructive" : overview.deployment.kind === "not-installed" ? "outline" : "secondary"}>
        {t(KIND_KEY[overview.deployment.kind])}
      </Badge>
      <span className="deploy-mono text-xs text-muted-foreground">{overview.deployment.workerName}</span>
      {overview.deployment.deployedSha
        ? <span className="deploy-mono text-xs text-muted-foreground">· {t("deployedCommit", { sha: shortSha(overview.deployment.deployedSha) })}</span> : null}
    </div> : null}
    {runView?.run ? <Notice>{t("resumeRun")}</Notice> : null}
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

export function ReviewStep({ t, tMaybe, overview, accountName, starting, onStart }: {
  t: Translate; tMaybe: TMaybe; overview: AccountOverview; accountName: string; starting: boolean;
  onStart: (legacyAdoptionApproved: boolean) => void;
}) {
  const [adopt, setAdopt] = useState(false);
  const install = overview.install;
  const update = overview.update;
  const blocked = overview.blockers.length > 0 || !overview.release || overview.upToDate;
  const needsAdoption = Boolean(update?.legacyAdoptionRequired);
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

    {overview.upToDate ? <Notice tone="success">{t("upToDate")}</Notice> : null}

    {install ? <div className="space-y-3">
      <Eyebrow>{t("installPlanTitle")}</Eyebrow>
      <PlanList items={[
        t("planWorker", { name: install.workerName }),
        t(install.database.action === "create" ? "planDatabaseCreate" : "planDatabaseReuse", { name: install.database.name }),
        t(install.kvNamespace.action === "create" ? "planKvCreate" : "planKvReuse", { name: install.kvNamespace.name }),
        t("planMigrations", { count: install.migrations }),
        install.crons.length ? t("planCrons", { list: install.crons.join(", ") }) : null,
        t("planSecrets"),
        install.analyticsDatasets.length ? t("planAnalytics") : null,
        install.workersDevSubdomain ? t("planUrl", { url: `https://${install.workerName}.${install.workersDevSubdomain}.workers.dev` }) : null
      ]} />
      {!install.workersDevSubdomain ? <Notice tone="warning">{t("planNoWorkersDev")}</Notice> : null}
      {install.analyticsDatasets.length ? <Notice>{t("planAnalyticsNote")}</Notice> : null}
    </div> : null}

    {update ? <div className="space-y-3">
      <Eyebrow>{t("updatePlanTitle")}</Eyebrow>
      <PlanList items={[
        t("updateFromTo", { from: shortSha(update.fromSha) || t("unknownVersion"), to: shortSha(overview.release?.sha) }),
        update.pendingMigrations ? t("updatePendingMigrations", { count: update.pendingMigrations }) : t("updateNoMigrations"),
        update.durableObjectMigration ? t("updateDoMigration") : null
      ]} />
      {update.destructiveMigrations ? <Notice tone="warning">{t("updateDestructive")}</Notice> : null}
      <Notice>{t("updateSafety")}</Notice>
      {needsAdoption ? <label className="flex items-start gap-3 border border-border p-4 text-xs leading-5">
        <Checkbox checked={adopt} onCheckedChange={value => setAdopt(value === true)} className="mt-0.5" />
        <span>{t("legacyAdopt")}</span>
      </label> : null}
    </div> : null}

    {(install || update) && !overview.upToDate ? <>
      <Separator />
      <ConfirmOperation
        title={t(install ? "confirmInstallTitle" : "confirmUpdateTitle")}
        description={install ? t("confirmInstallDesc", { account: accountName }) : t("confirmUpdateDesc")}
        confirmText={t("confirm")} cancelText={t("cancel")} onConfirm={() => onStart(adopt)}>
        <Button disabled={blocked || starting || (needsAdoption && !adopt)}>
          {starting ? <RiLoader4Line data-icon="inline-start" className="animate-spin" /> : <RiArrowRightLine data-icon="inline-start" />}
          {t(install ? "installButton" : "updateButton")}
        </Button>
      </ConfirmOperation>
    </> : null}
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

export function DeployStep({ t, tMaybe, run, otherTab, reconnect, working, error, onRetry, onStartOver }: {
  t: Translate; tMaybe: TMaybe; run: PipelineRun; otherTab: boolean; reconnect: boolean; working: boolean;
  error: string; onRetry: () => void; onStartOver: () => void;
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
              <span className="text-[11px] text-muted-foreground">{t(active ? "statusRunning" : STATUS[step.status])}</span>
            </div>
            {note ? <p className="deploy-mono mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
            {step.status === "failed" && step.note?.message ? <p className="deploy-mono mt-1 text-xs text-destructive">{step.note.message}</p> : null}
          </div>
        </li>;
      })}
    </ol>
    {run.phase === "running" ? <Notice>{t("deployDesc")}</Notice> : null}
    {otherTab ? <Notice>{t("otherTab")}</Notice> : null}
    {reconnect ? <Notice tone="warning" action={<Button asChild><a href={CONNECT_URL}>{t("connectButton")}</a></Button>}>{t("reconnectNeeded")}</Notice> : null}
    {error && !reconnect ? <Notice tone="error">{error}</Notice> : null}
    {run.phase === "failed" ? <Notice tone="error" title={t("runFailedTitle")} action={
      <div className="flex flex-wrap gap-2">
        {!run.state.rolledBack ? <Button onClick={onRetry} disabled={working}><RiRefreshLine data-icon="inline-start" />{t("retry")}</Button> : null}
        <Button variant="outline" onClick={onStartOver} disabled={working}>{t("startOver")}</Button>
      </div>}>
      {run.state.rolledBack ? t("rolledBackDesc") : t("runFailedDesc")}
    </Notice> : null}
  </div>;
}

/* --------------------------------- Done -------------------------------- */

export function DoneStep({ t, run, admin, accountId, savingPassword, onPasswordSaved, onFinish }: {
  t: Translate; run: PipelineRun; admin: RunView["admin"]; accountId: string; savingPassword: boolean;
  onPasswordSaved: () => void; onFinish: () => void;
}) {
  const url = run.state.workerUrl ?? null;
  const step = (id: string) => run.steps.find(item => item.id === id);
  const followUps: Array<{ text: string; href: string; label: string }> = [];
  if (run.state.analyticsEngine === "disabled") {
    followUps.push({ text: t("followAeEnable"), href: ANALYTICS_ENGINE_URL(accountId), label: t("enableAnalyticsEngine") });
  }
  if (step("analytics")?.note?.code === "AE_READER_MANUAL") {
    followUps.push({ text: t("followAeReader"), href: url ? url + "/" : CLOUDFLARE_WORKER_URL(accountId), label: url ? t("openDashboard") : t("openCloudflare") });
  }
  if (step("subdomain")?.note?.code === "WORKERS_DEV_MISSING") {
    followUps.push({ text: t("followWorkersDev"), href: CLOUDFLARE_WORKER_URL(accountId), label: t("openCloudflare") });
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

    {run.intent === "install" ? <div className="space-y-4 border border-border p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t("adminTitle")}</p>
        <p className="text-xs leading-5 text-muted-foreground">{admin ? t("adminDesc") : t("passwordForgotten")}</p>
      </div>
      {admin ? <>
        <CopyValue label={t("username")} value={admin.username} t={t} />
        <CopyValue label={t("password")} value={admin.password} t={t} />
        <Button variant="outline" onClick={onPasswordSaved} disabled={savingPassword}>
          <RiCheckLine data-icon="inline-start" />{t("passwordSaved")}
        </Button>
      </> : null}
    </div> : null}

    {followUps.length ? <div className="space-y-3">
      <Eyebrow>{t("followUpTitle")}</Eyebrow>
      {followUps.map(item => <Notice key={item.text} tone="warning" action={
        <Button variant="outline" asChild><a href={item.href} target="_blank" rel="noreferrer"><RiExternalLinkLine data-icon="inline-start" />{item.label}</a></Button>}>
        {item.text}
      </Notice>)}
    </div> : null}

    <Separator />
    <Button variant="outline" onClick={onFinish} disabled={Boolean(admin)}>{t("finish")}</Button>
  </div>;
}
