import { useCallback, useEffect, useRef, useState } from "react";
import {
  RiCloudLine, RiServerLine, RiFileList3Line, RiRocketLine, RiFlagLine,
  RiShieldCheckLine, RiArrowLeftLine, RiArrowRightLine, RiGlobalLine, RiMoonLine, RiSunLine,
  RiComputerLine, RiArrowDownSLine, RiCheckLine, RiLoader4Line, RiLogoutBoxRLine, RiRefreshLine, RiDeleteBinLine
} from "@remixicon/react";
import type { UninstallPlan } from "../core/uninstall";
import { Button } from "@insightflare/ui/button";
import { Badge } from "@insightflare/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@insightflare/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem
} from "@insightflare/ui/dropdown-menu";
import { SUPPORTED_LOCALES } from "../lib/i18n/config";
import { nativeLocaleName } from "../lib/i18n/native-locale-names";
import { useTheme } from "./theme-provider";
import { api, ApiError, ANALYTICS_READER_SCOPES, CONNECT_URL, type Account, type AccountOverview, type PipelineRun, type RunView, type Session } from "./api";
import { track, trackOAuthCallback, trackOAuthStart, trackPlan } from "./analytics";
import { ConfirmOperation, Notice, errorText, useI18n } from "./ui";
import { AutoResizer } from "@insightflare/ui/auto-resizer";
import { AutoTransition } from "@insightflare/ui/auto-transition";
import { AccountStep, ConnectStep, DeployStep, DoneStep, ReviewStep, UninstallReview, reviewDecision, useReviewForm } from "./steps";

const STEP_COUNT = 5;
const ACCOUNT_KEY = "ifd:wizard:account";
/** Pause between advances while waiting for a new workers.dev address. */
const HEALTH_WAIT_MS = 4000;
const FOLLOW_POLL_MS = 3000;

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

function runMode(run: PipelineRun) {
  return run.intent === "update" && (run.configurationOnly || run.state.previousSha === run.sourceSha)
    ? "configure" : run.intent;
}

export function App() {
  const { locale, t, tMaybe, hrefForLocale } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ThemeIcon = (theme === "system" ? resolvedTheme : theme) === "dark" ? RiMoonLine : RiSunLine;

  const [session, setSession] = useState<Session>({ connected: false, oauthConfigured: false, expiresAt: null, scopes: null });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(() => typeof window === "undefined" ? "" : window.sessionStorage.getItem(ACCOUNT_KEY) ?? "");
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [runView, setRunView] = useState<RunView | null>(null);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [runError, setRunError] = useState("");
  const [otherTab, setOtherTab] = useState(false);
  const [reconnect, setReconnect] = useState(false);
  const [working, setWorking] = useState(false);
  const [finishedHere, setFinishedHere] = useState(false);
  const reviewForm = useReviewForm();
  const [uninstallPlan, setUninstallPlan] = useState<UninstallPlan | null>(null);
  const [uninstallConfirm, setUninstallConfirm] = useState("");
  const [uninstallLoading, setUninstallLoading] = useState(false);
  // Cloudflare does not pre-select API token management on the consent page.
  const readerMissing = session.connected && session.scopes !== null &&
    !ANALYTICS_READER_SCOPES.every(scope => session.scopes!.includes(scope));

  const run = runView?.run ?? null;
  const accountName = accounts.find(account => account.id === accountId)?.name ?? accountId;

  useEffect(() => { window.sessionStorage.setItem(ACCOUNT_KEY, accountId); }, [accountId]);

  // Session, plus any OAuth error passed back on the redirect.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setMessage(t("authFailed", { error: code }));
    void api.session().then(value => {
      trackOAuthCallback(value.connected);
      setSession(value);
      setSessionLoaded(true);
      if (value.connected) setStep(current => Math.max(current, 1));
    }).catch(error => { setMessage(errorText(t, error)); setSessionLoaded(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session.connected) return;
    let cancelled = false;
    void api.accounts().then(value => {
      if (cancelled) return;
      setAccounts(value.accounts);
      if (value.accounts.length === 1 && !accountId) setAccountId(value.accounts[0]!.id);
      else if (accountId && !value.accounts.some(account => account.id === accountId)) setAccountId("");
    }).catch(error => { if (!cancelled) setMessage(errorText(t, error)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.connected]);

  const accountLoad = useRef(0);
  const selectedAccount = useRef(accountId);
  selectedAccount.current = accountId;
  const loadAccount = useCallback(async (id: string) => {
    const generation = ++accountLoad.current;
    setUninstallPlan(null); setUninstallConfirm("");
    setOverview(null); setRunView(null); setRunError(""); setOtherTab(false); setFinishedHere(false);
    if (!id) return;
    setOverviewLoading(true);
    try {
      const [over, saved] = await Promise.allSettled([api.overview(id), api.run(id)]);
      if (generation !== accountLoad.current || selectedAccount.current !== id) return;
      if (over.status === "fulfilled") setOverview(over.value.overview);
      else setMessage(errorText(t, over.reason));
      if (saved.status === "rejected") throw saved.reason;
      const current = saved.value;
      setRunView(current);
      // A run in progress, failed, or with a password still to be saved takes over the
      // wizard; a finished one is history and the user starts from the review again.
      if (current.run && (current.run.phase !== "succeeded" || current.admin?.password)) {
        setStep(current.run.phase === "succeeded" ? 4 : 3);
      }
    } catch (error) {
      setMessage(errorText(t, error));
    } finally {
      if (generation === accountLoad.current) setOverviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session.connected && accountId) void loadAccount(accountId);
  }, [session.connected, accountId, loadAccount]);

  // Drive the run: one server-side step per request until it settles.
  const driving = useRef(false);
  useEffect(() => {
    if (!run || run.phase !== "running" || step !== 3 || driving.current || reconnect) return;
    driving.current = true;
    let cancelled = false;
    void (async () => {
      let current = run;
      try {
        while (!cancelled && current.phase === "running") {
          let next: RunView;
          try {
            const advanced = await api.advance(accountId, current.id);
            next = advanced;
            if (advanced.settled && advanced.run?.id === current.id) {
              const result = advanced.run;
              if (result.phase === "succeeded") track(`deploy_${runMode(result)}_succeeded`);
              if (result.failure) track("deploy_run_failed", {
                mode: runMode(result), step: result.failure.step, code: result.failure.code
              });
            }
            setOtherTab(false);
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) { setReconnect(true); return; }
            if (error instanceof ApiError && error.status === 409 && /another tab|processed/i.test(error.message)) {
              // Someone else holds the lease: follow along instead of competing.
              setOtherTab(true);
              await sleep(FOLLOW_POLL_MS);
              next = await api.run(accountId);
            } else {
              throw error;
            }
          }
          if (cancelled) return;
          setRunView(next);
          if (!next.run) return;
          current = next.run;
          const waiting = current.steps.find(item => item.status === "pending")?.note?.code === "WAITING";
          if (waiting) await sleep(HEALTH_WAIT_MS);
        }
        if (!cancelled && current.phase === "succeeded") { setFinishedHere(true); setStep(4); }
      } catch (error) {
        if (!cancelled) setRunError(errorText(t, error));
      } finally {
        driving.current = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.phase, step, reconnect, accountId]);

  async function reviewUninstall() {
    setUninstallLoading(true); setMessage(""); setUninstallConfirm("");
    try {
      const result = await api.uninstallPreview(accountId);
      if (selectedAccount.current !== accountId) return;
      setUninstallPlan(result.plan);
      trackPlan("uninstall", accountId, result.plan.digest);
      setStep(2);
    } catch (error) { setMessage(errorText(t, error)); }
    finally { setUninstallLoading(false); }
  }

  async function startUninstall() {
    if (!uninstallPlan || uninstallPlan.accountId !== accountId || uninstallConfirm !== "insightflare") return;
    setWorking(true); setMessage("");
    try {
      const view = await api.startUninstall(accountId, uninstallPlan.digest, uninstallConfirm);
      if (view.run) track("deploy_uninstall_started", { kind: uninstallPlan.cleanupRunId ? "cleanup" : "installation" });
      if (selectedAccount.current !== accountId) return;
      setRunView(view); setUninstallPlan(null); setUninstallConfirm(""); setStep(3);
    } catch (error) { setMessage(errorText(t, error)); }
    finally { setWorking(false); }
  }

  async function startRun(legacyAdoptionApproved: boolean, adminPassword?: string, customDomain?: { zoneId: string; subdomain: string }) {
    if (!overview?.release || !overview.intent) return;
    setWorking(true); setRunError("");
    try {
      const view = await api.startRun(accountId, {
        intent: overview.intent, sourceSha: overview.release.sha,
        artifactDigest: overview.release.artifactDigest, legacyAdoptionApproved,
        ...(adminPassword ? { adminPassword } : {}),
        ...(customDomain ? { customDomain } : {})
      });
      if (view.run) track(`deploy_${runMode(view.run)}_started`);
      setRunView(view);
      setStep(3);
    } catch (error) {
      setMessage(errorText(t, error));
    } finally { setWorking(false); }
  }

  async function act(action: () => Promise<RunView>, then?: (view: RunView) => void) {
    setWorking(true); setRunError("");
    try {
      const view = await action();
      setRunView(view);
      then?.(view);
    } catch (error) {
      setRunError(errorText(t, error));
    } finally { setWorking(false); }
  }

  async function disconnect() {
    try {
      await api.disconnect();
      window.location.replace(hrefForLocale(locale));
    } catch (error) { setMessage(errorText(t, error)); }
  }

  const steps = [
    { title: t("stepConnect"), heading: t("connectTitle"), description: t("connectDesc"), icon: RiCloudLine },
    { title: t("stepAccount"), heading: t("accountTitle"), description: t("accountDesc"), icon: RiServerLine },
    { title: t("stepReview"), heading: t(uninstallPlan ? "uninstallTitle" : "reviewTitle"), description: t(uninstallPlan ? "uninstallReviewDesc" : "reviewDesc"), icon: RiFileList3Line },
    { title: t(uninstallPlan || run?.intent === "uninstall" ? "uninstallButton" : "stepDeploy"), heading: t(run?.intent === "uninstall" ? "uninstallRunning" : "deployTitle"), description: t("deployDesc"), icon: RiRocketLine },
    { title: t("stepDone"), heading: run?.intent === "uninstall" ? t("uninstallDoneTitle") : run?.intent === "update" ? t("doneUpdateTitle") : t("doneInstallTitle"), description: "", icon: RiFlagLine }
  ];
  // Finished runs only stay on screen right after they finish or while a password is pending.
  const liveRun = run && (run.phase !== "succeeded" || finishedHere || Boolean(runView?.admin?.password)) ? run : null;
  const completed = [
    session.connected,
    Boolean(session.connected && accountId && (overview || liveRun)),
    Boolean(liveRun),
    liveRun?.phase === "succeeded",
    liveRun?.phase === "succeeded" && !runView?.admin?.password
  ];
  const reachable = (index: number) => {
    if (index === 0) return true;
    if (!session.connected) return false;
    if (uninstallPlan && index === 2) return true;
    if (liveRun) return index === 1 || index === 3 || (index === 4 && liveRun.phase === "succeeded");
    return index <= 2 && (index < 2 || Boolean(overview));
  };
  // With a run in progress the account step continues straight to it.
  const nextStep = step === 1 && liveRun ? (liveRun.phase === "succeeded" ? 4 : 3) : step + 1;
  const review = overview ? reviewDecision(overview, readerMissing, reviewForm) : null;
  const planMode = review && !review.blocked ? (review.configureOnly ? "configure" : review.mode) : null;
  const planArtifact = overview?.release?.artifactDigest;
  useEffect(() => {
    if (step === 2 && !uninstallPlan && planMode && planArtifact) trackPlan(planMode, accountId, planArtifact);
  }, [step, planMode, accountId, planArtifact, uninstallPlan]);
  const canContinue = step < 2 && completed[step] && reachable(nextStep);
  const finished = completed.filter(Boolean).length;
  const percent = Math.round((finished / STEP_COUNT) * 100);
  const current = steps[step]!;
  // Entering/leaving uninstall review does not change the numeric wizard step.
  // Key the animated content by both stage and operation, not changing inputs.
  const isUninstallReview = step === 2 && Boolean(uninstallPlan);
  const pageKey = step === 2 ? (isUninstallReview ? "review:uninstall" : "review:deploy")
    : step >= 3 ? step + ":" + (run?.intent ?? "none") : String(step);
  const showReviewAction = step === 2 && !uninstallPlan &&
    Boolean(review?.mode || overview?.deployment.kind === "managed");

  return <div className="min-h-screen bg-background font-mono text-foreground antialiased">
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={hrefForLocale(locale)} className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/android-chrome-192x192.png" alt="" width={24} height={24} className="size-6 shrink-0" />{t("brand")}
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={session.connected ? "secondary" : "outline"}>{t(session.connected ? "connected" : "disconnected")}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t("theme")}>
                <ThemeIcon data-icon="inline-start" />{t("theme")}<RiArrowDownSLine data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel><DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={theme} onValueChange={value => {
                if (value === "light" || value === "dark" || value === "system") setTheme(value);
              }}>
                <DropdownMenuRadioItem value="light"><RiSunLine className="size-4" />{t("lightTheme")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><RiMoonLine className="size-4" />{t("darkTheme")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><RiComputerLine className="size-4" />{t("systemTheme")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t("language")}>
                <RiGlobalLine data-icon="inline-start" />{t("language")}<RiArrowDownSLine data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("language")}</DropdownMenuLabel><DropdownMenuSeparator />
              {SUPPORTED_LOCALES.map(target => <DropdownMenuItem key={target} asChild>
                <a href={hrefForLocale(target)}>
                  <span className="inline-flex size-4 items-center justify-center">{locale === target ? <RiCheckLine className="size-4" /> : null}</span>
                  {nativeLocaleName(target)}
                </a>
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="mx-auto w-full max-w-3xl text-xs leading-5 text-muted-foreground">{t("wizardHelp")}</p>

      <div className="mx-auto w-full max-w-3xl">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b border-border/70 px-4 py-5 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="font-medium tracking-wide">{t("stepCount", { current: step + 1, total: STEP_COUNT })}</span>
              <span>{t("progress")} · {percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-none bg-secondary" role="progressbar"
              aria-label={t("progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className="h-full rounded-none bg-primary transition-all duration-300" style={{ width: percent + "%" }} />
            </div>
            <ol className="deploy-steps mt-5 grid grid-cols-5 gap-1" aria-label={t("wizard")}>
              {steps.map((item, i) => {
                const Icon = item.icon;
                return <li key={i} className="min-w-0">
                  <button type="button" onClick={() => setStep(i)} disabled={!reachable(i)}
                    aria-current={step === i ? "step" : undefined}
                    className="deploy-step flex w-full flex-col items-stretch gap-1.5 rounded-none p-1 text-center text-[11px] transition-colors sm:text-xs"
                    data-active={step === i} data-complete={completed[i]}>
                    <span className="deploy-step-circle flex h-9 w-full items-center justify-center rounded-none border">
                      {completed[i] && i !== step ? <RiShieldCheckLine className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <AutoTransition as="span" className="block max-w-full truncate" initial={false} transitionKey={item.title} type="fade" duration={0.16}>{item.title}</AutoTransition>
                  </button>
                </li>;
              })}
            </ol>
          </CardHeader>

          <AutoResizer duration={0.24}>
          <CardContent className="px-4 py-6 sm:px-6" role="region" aria-labelledby="wizard-step-title">
            <AutoTransition transitionKey={pageKey} type="fade" duration={0.18}>
            <div className="mb-6 space-y-2">
              <CardTitle><h2 id="wizard-step-title" className="text-lg font-semibold tracking-tight">{current.heading}</h2></CardTitle>
              {current.description && step !== 3 ? <CardDescription>{current.description}</CardDescription> : null}
            </div>
            <AutoTransition transitionKey={message ? "message" : "none"} type="fade" duration={0.18}>
              {message ? <div className="mb-5"><Notice tone="error" action={
                <Button variant="ghost" onClick={() => setMessage("")}>{t("dismiss")}</Button>}>{message}</Notice></div> : null}
            </AutoTransition>

            {!sessionLoaded ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLoader4Line className="size-4 animate-spin" />{t("loading")}</p>
              : step === 0 ? <ConnectStep t={t} session={session} locale={locale} readerMissing={readerMissing} />
              : step === 1 ? <AccountStep t={t} accounts={accounts} accountId={accountId} onSelect={setAccountId}
                  overview={overview} loading={overviewLoading} runView={liveRun ? runView : null} />
              : step === 2 && uninstallPlan ? <UninstallReview t={t} plan={uninstallPlan} confirmation={uninstallConfirm} onConfirmation={setUninstallConfirm} />
              : step === 2 && overview ? <ReviewStep t={t} tMaybe={tMaybe} overview={overview} accountId={accountId}
                  readerMissing={readerMissing} form={reviewForm} onRecheck={() => void loadAccount(accountId)} />
              : step === 3 && run ? <DeployStep t={t} tMaybe={tMaybe} run={run} otherTab={otherTab} reconnect={reconnect} error={runError} />
              : step === 4 && run ? <DoneStep t={t} run={run} admin={runView?.admin ?? null} accountId={accountId} />
              : null}
            </AutoTransition>
          </CardContent>

          {/* Every step's primary action sits where "Continue" is; secondary ones go left. */}
          <CardFooter className="block border-t border-border/70 px-4 py-4 sm:px-6">
            <AutoTransition transitionKey={pageKey} type="fade" duration={0.18} initial={false}
              className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {step === 0 && session.connected ? <Button variant="outline" onClick={() => void disconnect()}>
                <RiLogoutBoxRLine data-icon="inline-start" />{t("disconnect")}</Button> : null}
              {step === 1 || step === 2 ? <Button variant="outline" onClick={() => { if (uninstallPlan) { setUninstallPlan(null); setUninstallConfirm(""); if (run?.phase === "failed") setStep(3); } else setStep(s => s - 1); }} disabled={working || uninstallLoading}>
                <RiArrowLeftLine data-icon="inline-start" />{t("back")}</Button> : null}
              {step === 3 && run?.phase === "failed" && run.intent !== "uninstall" ? <Button variant="outline" disabled={working}
                onClick={() => void act(() => api.dismiss(accountId, run.id), () => { setStep(2); void loadAccount(accountId); })}>
                {t("startOver")}</Button> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {step === 0 && !session.connected ? <Button asChild={session.oauthConfigured} disabled={!session.oauthConfigured}>
                {session.oauthConfigured
                  ? <a href={CONNECT_URL} onClick={trackOAuthStart}><RiCloudLine data-icon="inline-start" />{t("connectButton")}</a>
                  : <span><RiCloudLine data-icon="inline-start" />{t("connectButton")}</span>}
              </Button> : null}
              {(step === 0 && session.connected) || step === 1 ? <Button onClick={() => setStep(nextStep)} disabled={!canContinue}>
                {t("next")}<RiArrowRightLine data-icon="inline-end" /></Button> : null}
              {step === 2 && uninstallPlan ? <ConfirmOperation destructive
                title={t("uninstallConfirmTitle")} description={t("uninstallWarning")}
                confirmText={t("uninstallButton")} cancelText={t("cancel")} onConfirm={() => void startUninstall()}>
                <Button variant="destructive" disabled={working || uninstallConfirm !== "insightflare"}>
                  <RiDeleteBinLine data-icon="inline-start" />{t("uninstallButton")}
                </Button>
              </ConfirmOperation> : null}
              {((step === 2 && !uninstallPlan && overview?.deployment.kind === "managed") ||
                 (step === 3 && run?.phase === "failed" && run.intent === "install" && (run.state.databaseId || run.state.kvNamespaceId))) ? <Button variant="outline" className="text-destructive" disabled={working || uninstallLoading}
                onClick={() => void reviewUninstall()}>
                {uninstallLoading ? <RiLoader4Line data-icon="inline-start" className="animate-spin" /> : <RiDeleteBinLine data-icon="inline-start" />}
                {t(step === 3 ? "uninstallCleanup" : "uninstallButton")}
              </Button> : null}
              {showReviewAction ? <ConfirmOperation
                title={t(review?.mode === "install" ? "confirmInstallTitle" : review?.mode === "configure" ? "confirmConfigureTitle" : "confirmUpdateTitle")}
                description={review?.mode === "install" ? t("confirmInstallDesc", { account: accountName })
                  : review?.mode === "configure" ? t("confirmConfigureDesc")
                  : t(review?.hasMigrations ? "confirmUpdateDesc" : "confirmUpdateNoMigrationDesc")}
                confirmText={t("confirm")} cancelText={t("cancel")}
                onConfirm={() => {
                  if (!review?.available || review.blocked || working || uninstallLoading) return;
                  void startRun(reviewForm.adopt, review.install && review.custom ? reviewForm.password : undefined,
                    review.domainNew ? { zoneId: reviewForm.zoneId, subdomain: reviewForm.subdomain.trim().toLowerCase() } : undefined);
                }}>
                <Button disabled={!review?.available || review.blocked || working || uninstallLoading}>
                  {working ? <RiLoader4Line data-icon="inline-start" className="animate-spin" /> : <RiArrowRightLine data-icon="inline-start" />}
                  {t(review?.mode === "install" ? "installButton" : review?.mode === "configure" ? "configureButton" : "updateButton")}
                </Button>
              </ConfirmOperation> : null}
              {step === 3 && run?.phase === "running" ? <Button disabled>
                <RiLoader4Line data-icon="inline-start" className="animate-spin" />{t("statusRunning")}</Button> : null}
              {step === 3 && run?.phase === "failed" && !run.state.rolledBack && (run.intent === "uninstall" || run.failure?.code !== "SOURCE_MOVED")
                ? <Button onClick={() => void act(() => api.retry(accountId, run.id), view => {
                  if (view.run?.id === run.id) track("deploy_run_retried", { mode: runMode(view.run) });
                })} disabled={working}>
                  <RiRefreshLine data-icon="inline-start" />{t("retry")}</Button> : null}
              {step === 4 && run && runView?.admin?.password ? <Button onClick={() => void act(() => api.passwordSaved(accountId, run.id))} disabled={working}>
                <RiCheckLine data-icon="inline-start" />{t("passwordSaved")}</Button> : null}
              {step === 4 && run && !runView?.admin?.password ? <Button disabled={working}
                onClick={() => void act(() => api.dismiss(accountId, run.id), () => { setStep(1); void loadAccount(accountId); })}>
                {t("finish")}<RiArrowRightLine data-icon="inline-end" /></Button> : null}
            </div>
            </AutoTransition>
          </CardFooter>
          </AutoResizer>
        </Card>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">{t("tagline")}</p>
      </div>
    </main>
  </div>;
}
