import { useEffect, useState, type ReactNode } from "react";
import { pageMessages } from "./locale-route";
import { localizeApiCopy, localizeBuildStatus, localizeResourceDisposition } from "./api-copy";
import { SUPPORTED_LOCALES } from "../lib/i18n/config";
import type { DeployMessageKey } from "../lib/i18n/messages";
import { formatI18nTemplate } from "../lib/i18n/template";
import { nativeLocaleName } from "../lib/i18n/native-locale-names";
import { useTheme } from "./theme-provider";
import {
  RiCloudLine, RiGitBranchLine, RiGithubLine, RiRefreshLine, RiLockLine,
  RiExternalLinkLine, RiLayoutGridLine, RiShieldCheckLine, RiCodeSSlashLine,
  RiServerLine, RiTerminalBoxLine, RiLogoutBoxRLine, RiInformationLine,
  RiAlertLine, RiArrowLeftLine, RiArrowRightLine, RiGlobalLine, RiMoonLine, RiSunLine, RiComputerLine, RiArrowDownSLine, RiCheckLine
} from "@remixicon/react";
import { Button } from "@insightflare/ui/button";
import { Badge } from "@insightflare/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@insightflare/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem } from "@insightflare/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTrigger, AlertDialogAction, AlertDialogCancel, AlertDialogTitle, AlertDialogDescription } from "@insightflare/ui/alert-dialog";
import { Checkbox } from "@insightflare/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@insightflare/ui/select";
import { Separator } from "@insightflare/ui/separator";

type Account = { id: string; name: string };
type Source = { sha: string; shortSha: string; message: string; committedAt: string | null; url: string };
type Session = { connected: boolean; oauthConfigured: boolean; expiresAt: number | null };
type Kind = "not-installed" | "managed" | "legacy-candidate" | "conflict";
type Deployment = { kind: Kind; workerName: string; deployedSha: string | null; issues: string[] };
type BuildReadiness = {
  state: string; triggerCount: number; candidateTriggerCount: number;
  hasUserBuildToken: boolean; repoConnectedToUpstream: boolean;
  verifiedUserBuild: false; executionAvailable: false; message: string;
  verifiedRepoIdentity?: boolean; canStageWithoutPromotion?: boolean;
  automaticPushBuildPossible?: boolean; safetyBlockers?: string[];
};
type D1Database = { uuid: string; name: string; version?: string };
type D1Preview = {
  sourceSha: string; artifactDigest: string; databaseId: string;
  deploymentKind: Kind; totalMigrations: number;
  appliedMigrations: number; pendingMigrations: number;
  initialInstall: boolean; destructiveUpgrade: boolean;
  needsConfirmation: boolean; recoveryBookmarkAvailable: boolean;
  reviewedPlanDigest: string; migrationExecutionAvailable: true;
  executionAvailable: false; blockers: string[];
  pending: Array<{ name: string; sha256: string; sqlBytes: number; destructive: boolean; warnings: string[] }>;
};
type VersionPreview = {
  sourceSha:string;artifactDigest:string;expectedActiveVersionId:string;
  workerName:"insightflare";deploymentKind:"managed"|"legacy-candidate";
  legacyAdoptionRequired:boolean;activeMigrationTag:string;targetMigrationTag:string;
  requiresDoMigration:boolean;databaseId:string;existingBindingsPreserved:number;
  stageAvailable:true;activationRequiresD1Current:true;
};
type StagedVersion = {
  stagedVersionId:string;sourceSha:string;artifactDigest:string;
  activeVersionUnchanged:true;bindingsVerified:true;migrationTagVerified:true;
  canPromote:false;
};
type VerifiedCandidate = {
  stagedVersionId:string;sourceSha:string;artifactDigest:string;
  expectedActiveVersionId:string;createdOn:string|null;
};
type ActivatedVersion = {
  deploymentId:string;previousActiveVersionId:string;activatedVersionId:string;
  sourceSha:string;workerName:"insightflare";databaseMigrationsCurrent:true;
};
type PreparedRun = {
  id: string; intent: "install" | "update" | "repair";
  pinnedSha: string; createdAt: number; expiresAt: number;
  phase: "blocked"; blockers: string[]; executionEnabled: false;
};
type Intent = "install" | "update" | "repair";
type Plan = { intent: Intent; sourceSha: string; blockers: string[]; proposedSteps: string[]; allowed: boolean };
type ResourcePlan = {
  readyForExecution: false;
  blockers: string[];
  actions: Array<{ binding: string; resourceType: string; disposition: "create" | "preserve" | "block" | "optional"; description: string }>;
};
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const data = await result.json().catch(() => null) as (T & { error?: { message?: string } }) | null;
  if (!result.ok) throw new Error(data?.error?.message || "Request failed (HTTP " + result.status + ")");
  if (data === null) throw new Error("Invalid API response");
  return data;
}
function errorText(e: unknown): string { return e instanceof Error ? e.message : "Unexpected error"; }
function Eyebrow({children}: {children: ReactNode}) {
  return <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{children}</p>;
}
function Notice({icon,title,text}:{icon:ReactNode;title:string;text:string}) {
  return <div className="flex items-start gap-3 rounded-none border border-border bg-muted/15 p-4">
    <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
    <div className="space-y-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs leading-5 text-muted-foreground">{text}</p></div>
  </div>;
}

function ConfirmOperation({children,title,description,confirmText,cancelText,onConfirm,destructive=false}:{
  children: ReactNode; title:string; description:string; confirmText:string;cancelText:string;
  onConfirm:()=>void; destructive?:boolean;
}) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle icon={destructive?RiAlertLine:RiShieldCheckLine}>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{cancelText}</AlertDialogCancel>
        <AlertDialogAction variant={destructive?"destructive":"default"} onClick={onConfirm}>{confirmText}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

export function App() {
  const { locale, messages, hrefForLocale } = pageMessages();
  const t = (key: DeployMessageKey, params?: Record<string,string|number>) =>
    formatI18nTemplate(messages.deploy[key],params??{});
  const {theme,resolvedTheme,setTheme}=useTheme();
  const ThemeIcon=(theme==="system"?resolvedTheme:theme)==="dark"?RiMoonLine:RiSunLine;
  const [step,setStep] = useState(()=>{ if(typeof window==="undefined") return 0; const saved=Number(window.sessionStorage.getItem("ifd:wizard:step")||"0"); return Number.isInteger(saved)&&saved>=0&&saved<=5?saved:0; });
  const [migrationAppliedCount,setMigrationAppliedCount] = useState(0);
  function goStep(next:number) { if(next>=0&&next<=5) setStep(next); }
  useEffect(()=>{window.sessionStorage.setItem("ifd:wizard:step",String(step));},[step]);
  const [session,setSession]=useState<Session>({connected:false,oauthConfigured:false,expiresAt:null});
  const [source,setSource]=useState<Source|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [accountId,setAccountId]=useState(()=>typeof window==="undefined"?"":window.sessionStorage.getItem("ifd:wizard:account")||"");
  useEffect(()=>{window.sessionStorage.setItem("ifd:wizard:account",accountId);},[accountId]);
  const [deployment,setDeployment]=useState<Deployment|null>(null);
  const [readiness,setReadiness]=useState<BuildReadiness|null>(null);
  const [readinessMessage,setReadinessMessage]=useState("");
  const [d1Databases,setD1Databases]=useState<D1Database[]>([]);
  const [databaseId,setDatabaseId]=useState("");
  const [d1Preview,setD1Preview]=useState<D1Preview|null>(null);
  const [d1Message,setD1Message]=useState("");
  const [d1Working,setD1Working]=useState(false);
  const [d1Applying,setD1Applying]=useState(false);
  const [versionPreview,setVersionPreview]=useState<VersionPreview|null>(null);
  const [stagedVersion,setStagedVersion]=useState<StagedVersion|null>(null);
  const [versionCandidates,setVersionCandidates]=useState<VerifiedCandidate[]>([]);
  const [activatedVersion,setActivatedVersion]=useState<ActivatedVersion|null>(null);
  const [versionMessage,setVersionMessage]=useState("");
  const [versionWorking,setVersionWorking]=useState(false);
  const [legacyReviewed,setLegacyReviewed]=useState(false);
  const [intent,setIntent]=useState<Intent>("install");
  const [plan,setPlan]=useState<Plan|null>(null);
  const [resourcePlan,setResourcePlan]=useState<ResourcePlan|null>(null);
  const [preparedRun,setPreparedRun]=useState<PreparedRun|null>(null);
  const [preparing,setPreparing]=useState(false);
  const [working,setWorking]=useState(false);
  const [sourceWorking,setSourceWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [accountMessage,setAccountMessage]=useState("");

  async function reloadSource(){
    setSourceWorking(true);
    try { setSource(await api<Source>("/api/v1/source/main")); }
    catch(e){ setMessage(errorText(e)); }
    finally { setSourceWorking(false); }
  }
  useEffect(()=>{
    const code = new URLSearchParams(window.location.search).get("error");
    if(code) setMessage(t("authFailed",{error:code}));
    void reloadSource();
    void api<Session>("/api/v1/session").then(setSession).catch(e=>setMessage(errorText(e)));
  },[]);

  useEffect(()=>{
    if(!session.connected) return;
    let cancelled=false;
    setAccountMessage(t("loading"));
    void api<{accounts:Account[]}>("/api/v1/providers/cloudflare/accounts")
      .then(v=>{if(!cancelled){setAccounts(v.accounts);setAccountMessage("");}})
      .catch(e=>{if(!cancelled)setAccountMessage(errorText(e));});
    return ()=>{cancelled=true;};
  },[session.connected]);

  useEffect(()=>{
    setPlan(null);
    setResourcePlan(null);
    setPreparedRun(null);
    if(!accountId){setDeployment(null);return;}
    let cancelled=false;
    setDeployment(null);
    setAccountMessage(t("discovering"));
    void api<{deployment:Deployment}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/deployment")
      .then(v=>{if(!cancelled){setDeployment(v.deployment);setIntent(v.deployment.kind==="not-installed"?"install":"update");setAccountMessage("");}})
      .catch(e=>{if(!cancelled)setAccountMessage(errorText(e));});
    return ()=>{cancelled=true;};
  },[accountId]);

  useEffect(()=>{
    setReadiness(null);
    if(!accountId){setReadinessMessage("");return;}
    let cancelled=false;
    setReadinessMessage(t("working"));
    void api<{readiness:BuildReadiness}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/build-readiness")
      .then(v=>{if(!cancelled){setReadiness(v.readiness);setReadinessMessage("");}})
      .catch(e=>{if(!cancelled)setReadinessMessage(errorText(e));});
    return ()=>{cancelled=true;};
  },[accountId]);

  useEffect(()=>{
    if(!accountId || !session.connected) return;
    let cancelled=false;
    void api<{run:PreparedRun|null}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/prepared-run")
      .then(v=>{if(!cancelled) setPreparedRun(v.run);})
      .catch(()=>{ /* A missing prior run is not an operational error. */ });
    return ()=>{cancelled=true;};
  },[accountId,session.connected]);

  useEffect(()=>{
    setVersionPreview(null);setStagedVersion(null);setVersionCandidates([]);setActivatedVersion(null);
    setLegacyReviewed(false);setVersionMessage("");
  },[accountId]);

  useEffect(()=>{
    setD1Databases([]);setDatabaseId("");setD1Preview(null);setD1Message("");
    if(!session.connected||!accountId) return;
    let cancelled=false;
    setD1Message(t("loading"));
    void api<{databases:D1Database[]}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/d1/databases")
      .then(v=>{if(!cancelled){setD1Databases(v.databases);setD1Message(v.databases.length?"":t("missing"));}})
      .catch(e=>{if(!cancelled)setD1Message(errorText(e));});
    return ()=>{cancelled=true;};
  },[session.connected,accountId]);

  async function applyD1Migrations(){
    if(!accountId || !databaseId || !d1Preview || d1Applying ||
       !d1Preview.pendingMigrations || !d1Preview.migrationExecutionAvailable) return;
    setD1Applying(true);setD1Message("");setMigrationAppliedCount(0);
    try {
      let digest=d1Preview.reviewedPlanDigest;
      let remaining=d1Preview.pendingMigrations;
      let applied=0;
      // Each API request applies up to four migration files. A closed tab or
      // interrupted request can be resumed by inspecting the D1 ledger again.
      for(let requests=0;remaining>0 && requests<150;requests++){
        const {progress}=await api<{progress:{
          sourceSha:string; databaseId:string; applied:string[];
          remaining:number; nextReviewedPlanDigest:string; completed:boolean
        }}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/d1/migrations/apply",{
          method:"POST",headers:{"Content-Type":"application/json",Origin:window.location.origin},
          body:JSON.stringify({
            databaseId,sourceSha:d1Preview.sourceSha,reviewedPlanDigest:digest
          })
        });
        if(!progress.applied.length || progress.remaining>=remaining) {
          throw new Error("D1 migration progress was not confirmed. Refresh the preview.");
        }
        applied+=progress.applied.length;
        setMigrationAppliedCount(applied);
        remaining=progress.remaining;
        digest=progress.nextReviewedPlanDigest;
        setD1Message(t("d1Progress",{applied,remaining}));
      }
      if(remaining>0) throw new Error("Migration process stopped; refresh the preview.");
      const updated=await api<{preview:D1Preview}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+
        "/d1/migration-preview?databaseId="+encodeURIComponent(databaseId)
      );
      setD1Preview(updated.preview);
      setD1Message(t("d1Complete"));
    }catch(e){
      setD1Message(errorText(e)+" "+t("d1ContinueHint"));
    }finally{setD1Applying(false);}
  }
  async function inspectWorkerVersions(){
    if(!accountId || versionWorking)return;
    setVersionWorking(true);setVersionPreview(null);setStagedVersion(null);
    setVersionCandidates([]);setActivatedVersion(null);setVersionMessage("");
    try{
      const {preview}=await api<{preview:VersionPreview}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/versions/preview");
      setVersionPreview(preview);
      setVersionMessage(t("stageContinueHint"));
    }catch(e){setVersionMessage(errorText(e));}
    finally{setVersionWorking(false);}
  }
  async function findStagedVersions(){
    if(!accountId || !versionPreview || versionWorking)return;
    setVersionWorking(true);setVersionCandidates([]);setVersionMessage("");
    try{
      const {candidates}=await api<{candidates:VerifiedCandidate[]}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/versions/candidates");
      setVersionCandidates(candidates.filter(item=>
        item.sourceSha===versionPreview.sourceSha &&
        item.artifactDigest===versionPreview.artifactDigest &&
        item.expectedActiveVersionId===versionPreview.expectedActiveVersionId));
      setVersionMessage(candidates.length?
        t("stageRestored"):
        t("stageRestoreEmpty"));
    }catch(e){setVersionMessage(errorText(e));}
    finally{setVersionWorking(false);}
  }
  async function stageWorkerVersion(){
    if(!accountId || !versionPreview || versionWorking ||
      (versionPreview.legacyAdoptionRequired && !legacyReviewed))return;
    setVersionWorking(true);setVersionMessage("");setStagedVersion(null);
    try{
      const {staged}=await api<{staged:StagedVersion}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/versions/stage",{
          method:"POST",headers:{"Content-Type":"application/json",Origin:window.location.origin},
          body:JSON.stringify({
            sourceSha:versionPreview.sourceSha,
            artifactDigest:versionPreview.artifactDigest,
            expectedActiveVersionId:versionPreview.expectedActiveVersionId,
            legacyAdoptionReviewed:legacyReviewed
          })
        });
      setStagedVersion(staged);
      setVersionMessage(t("stagedReady"));
    }catch(e){setVersionMessage(errorText(e)+" Inspect the current active Worker before retrying.");}
    finally{setVersionWorking(false);}
  }
  async function activateWorkerVersion(){
    if(!accountId || !versionPreview || !stagedVersion || versionWorking ||
      !d1Preview || d1Preview.databaseId!==versionPreview.databaseId ||
      d1Preview.sourceSha!==versionPreview.sourceSha || d1Preview.pendingMigrations!==0)return;
    setVersionWorking(true);setVersionMessage("");
    try{
      const {activation}=await api<{activation:ActivatedVersion}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/versions/activate",{
          method:"POST",headers:{"Content-Type":"application/json",Origin:window.location.origin},
          body:JSON.stringify({
            sourceSha:versionPreview.sourceSha,
            artifactDigest:versionPreview.artifactDigest,
            expectedActiveVersionId:versionPreview.expectedActiveVersionId,
            stagedVersionId:stagedVersion.stagedVersionId,
            approved:true,legacyAdoptionReviewed:legacyReviewed
          })
        });
      setActivatedVersion(activation);setStagedVersion(null);setVersionPreview(null);
      setVersionMessage(t("activationSuccess")+" · "+activation.deploymentId);
      const latest=await api<{deployment:Deployment}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/deployment");
      setDeployment(latest.deployment);
    }catch(e){setVersionMessage(errorText(e)+
      " Verify the active Worker deployment before attempting activation again.");}
    finally{setVersionWorking(false);}
  }
  async function previewD1(){
    if(!accountId || !databaseId || d1Working) return;
    setD1Working(true);setD1Preview(null);setD1Message("");
    try {
      const data=await api<{preview:D1Preview}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+
        "/d1/migration-preview?databaseId="+encodeURIComponent(databaseId)
      );
      setD1Preview(data.preview);
    } catch(e){setD1Message(errorText(e));}
    finally{setD1Working(false);}
  }
  async function preview(){
    if(!accountId)return;
    setWorking(true);setPlan(null);setResourcePlan(null);setPreparedRun(null);
    try{
      const r=await api<{plan:Plan;resourcePlan:ResourcePlan}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/plan?intent="+intent);
      setPlan(r.plan);
      setResourcePlan(r.resourcePlan);
    }catch(e){setMessage(errorText(e));}
    finally{setWorking(false);}
  }
  async function freezeReviewedSha(){
    if (!accountId || !plan || preparing) return;
    setPreparing(true);
    try {
      const response=await api<{run:PreparedRun}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+"/prepare",
        { method:"POST", headers:{ "Content-Type":"application/json", Origin:window.location.origin },
          body:JSON.stringify({intent:plan.intent,expectedSourceSha:plan.sourceSha}) }
      );
      setPreparedRun(response.run);
    } catch(e) {
      setPreparedRun(null);
      setMessage(errorText(e));
    } finally { setPreparing(false); }
  }
  async function disconnect(){
    try{
      await api("/api/v1/session/disconnect",{method:"POST",headers:{Origin:window.location.origin}});
      window.location.replace("/");
    }catch(e){setMessage(errorText(e));}
  }


  const stepDetails = [
    { title: t("stepConnect"), description: t("connectDesc"), icon: RiCloudLine },
    { title: t("stepAccount"), description: t("accountDesc"), icon: RiServerLine },
    { title: t("stepSource"), description: t("sourceDesc"), icon: RiGitBranchLine },
    { title: t("stepD1"), description: t("d1Desc"), icon: RiShieldCheckLine },
    { title: t("stepStage"), description: t("stageDesc"), icon: RiCodeSSlashLine },
    { title: t("stepActivate"), description: t("activateDesc"), icon: RiRefreshLine }
  ];
  const installationSupported = deployment?.kind === "managed" || deployment?.kind === "legacy-candidate";
  const d1Current = Boolean(
    d1Preview && d1Preview.pendingMigrations === 0 &&
    (!versionPreview || (d1Preview.databaseId === versionPreview.databaseId &&
      d1Preview.sourceSha === versionPreview.sourceSha))
  );
  const stepCompleted = [
    session.connected,
    Boolean(session.connected && accountId && deployment),
    Boolean(source && accountId && installationSupported),
    d1Current,
    Boolean(stagedVersion || activatedVersion),
    Boolean(activatedVersion)
  ];
  const mayAdvance = [
    session.connected, Boolean(accountId && deployment), Boolean(source && installationSupported),
    d1Current, Boolean(stagedVersion), false
  ];
  const stageBusy = d1Working || d1Applying || versionWorking || working || preparing;
  const selected = stepDetails[step] ?? stepDetails[0]!;
  const finishedCount = stepCompleted.filter(Boolean).length;
  const localizedStatus = (value: string) => value
    .replace(/Request failed \(HTTP (\d+)\)/g, (_full, status: string) => t("httpError",{status}))
    .replace(/Invalid API response/g, t("invalidResponse"))
    .replace(/Unexpected error/g, t("unexpectedError"));

  return <div className="min-h-screen bg-background text-foreground font-mono antialiased">
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={hrefForLocale(locale)} className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <RiLayoutGridLine className="size-5 text-primary"/>{t("brand")}
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={session.connected?"secondary":"outline"}>{t(session.connected?"connected":"disconnected")}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t("theme")}>
                <ThemeIcon data-icon="inline-start" className="size-4"/>{t("theme")}
                <RiArrowDownSLine data-icon="inline-end" className="size-3.5"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel><DropdownMenuSeparator/>
              <DropdownMenuRadioGroup value={theme} onValueChange={value=>{
                if(value==="light"||value==="dark"||value==="system")setTheme(value);
              }}>
                <DropdownMenuRadioItem value="light"><RiSunLine className="size-4"/>{t("lightTheme")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><RiMoonLine className="size-4"/>{t("darkTheme")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><RiComputerLine className="size-4"/>{t("systemTheme")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t("language")}>
                <RiGlobalLine data-icon="inline-start" className="size-4"/>{t("language")}
                <RiArrowDownSLine data-icon="inline-end" className="size-3.5"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("language")}</DropdownMenuLabel><DropdownMenuSeparator/>
              {SUPPORTED_LOCALES.map(target=><DropdownMenuItem key={target} asChild>
                <a href={hrefForLocale(target)}>
                  <span className="inline-flex size-4 items-center justify-center">
                    {locale===target?<RiCheckLine className="size-4"/>:null}
                  </span>
                  {nativeLocaleName(target)}
                </a>
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("brand")}</h1>
        <p className="max-w-prose text-xs leading-5 text-muted-foreground">{t("wizardHelp")}</p>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b border-border/70 px-4 py-5 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="font-medium tracking-wide">{t("stepCount",{current:step+1,total:stepDetails.length})}</span>
              <span>{t("progress")} · {Math.round((finishedCount / stepDetails.length) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-none bg-secondary" role="progressbar"
              aria-label={t("progress")} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round((finishedCount / stepDetails.length) * 100)}>
              <div className="h-full rounded-none bg-primary transition-all duration-300"
                style={{width:(finishedCount / stepDetails.length) * 100 + "%"}}/>
            </div>
            <ol className="deploy-steps mt-5 grid grid-cols-6 gap-1" aria-label={t("wizard")}>
              {stepDetails.map((item,i)=>{
                const Icon=item.icon;
                const done=stepCompleted[i];
                return <li key={i} className="min-w-0">
                  <button type="button" onClick={()=>goStep(i)} disabled={i>step && !stepCompleted.slice(0,i).every(Boolean)}
                    aria-current={step===i ? "step" : undefined}
                    className="deploy-step flex w-full flex-col items-center gap-1.5 rounded-none px-0.5 py-2 text-center text-[10px] transition-colors sm:text-xs"
                    data-active={step===i} data-complete={done}>
                    <span className="deploy-step-circle flex size-8 items-center justify-center rounded-none border">
                      {done && i !== step ? <RiShieldCheckLine className="size-4"/> : <Icon className="size-4"/>}
                    </span>
                    <span className="max-w-full truncate">{item.title}</span>
                  </button>
                </li>;
              })}
            </ol>
          </CardHeader>
          <CardContent className="min-h-[280px] px-4 py-6 sm:px-6" role="region" aria-labelledby="wizard-step-title">
            <div className="mb-6 space-y-2">
              <Eyebrow>{t("stepCount",{current:step+1,total:stepDetails.length})}</Eyebrow>
              <CardTitle><h2 id="wizard-step-title" className="text-lg font-semibold tracking-tight">
                {[
                  t("connectTitle"),t("accountTitle"),t("sourceTitle"),t("d1Title"),
                  t("stageTitle"),t("activateTitle")
                ][step]}
              </h2></CardTitle>
              <CardDescription>{selected.description}</CardDescription>
            </div>
            {message && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-none border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <div className="flex min-w-0 items-start gap-2"><RiAlertLine className="size-4 shrink-0 text-destructive"/><span className="break-words">{localizedStatus(message)}</span></div>
              <Button variant="ghost" onClick={()=>setMessage("")}>{t("dismiss")}</Button>
            </div>}
            {step===0 && <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-none border border-border/70 bg-muted/20 p-4">
                <RiShieldCheckLine className="mt-0.5 size-5 shrink-0 text-primary"/>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("dataPromise")}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{session.connected ? t("connectedDesc") : t("connectDesc")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {session.connected ?
                  <Badge variant="secondary">{t("connected")}</Badge> :
                  session.oauthConfigured ?
                    <Button asChild><a href="/api/v1/auth/cloudflare/start"><RiCloudLine/>{t("connectButton")}</a></Button> :
                    <Button disabled><RiLockLine/>{t("oauthMissing")}</Button>}
                {session.connected && <Button variant="outline" onClick={()=>void disconnect()}><RiLogoutBoxRLine/>{t("disconnect")}</Button>}
                <Button variant="outline" asChild><a href="https://github.com/RavelloH/InsightFlare" target="_blank" rel="noopener noreferrer">
                  <RiGithubLine/>{t("sourceGitHub")}<RiExternalLinkLine className="size-3.5"/></a></Button>
              </div>
            </div>}
            {step===1 && <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium" htmlFor="account-select">{t("accountLabel")}</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="account-select" className="w-full" disabled={!session.connected || !accounts.length}>
                    <SelectValue placeholder={t("accountPlaceholder")}/>
                  </SelectTrigger>
                  <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name||a.id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {accountMessage && <p role="status" className="text-xs leading-5 text-muted-foreground">{localizedStatus(accountMessage)}</p>}
              {deployment && <div className="space-y-3 rounded-none border border-border bg-muted/15 p-4 text-xs" data-testid="deployment-discovery">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{t("worker")}</span>
                  <Badge variant={deployment.kind==="managed"?"secondary":"outline"}>
                    {t(deployment.kind==="managed"?"managed":deployment.kind==="not-installed"?"noInstallation":deployment.kind==="conflict"?"conflict":"legacy")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{t("worker")}</span><code>{deployment.workerName}</code></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{t("deployedSha")}</span><code>{deployment.deployedSha?.slice(0,12)??t("unknown")}</code></div>
                {deployment.issues.map(issue=><p className="leading-relaxed text-muted-foreground" key={issue}>{localizeApiCopy(locale,issue)}</p>)}
              </div>}
              {deployment?.kind==="not-installed" && <Notice icon={<RiLockLine className="size-4"/>} title={t("installUnavailable")} text={t("installUnavailableHint")}/>}
            </div>}
            {step===2 && <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-border/70 bg-muted/10 p-4">
                <div className="min-w-0 space-y-1">
                  <Eyebrow>{t("sourceCommit")}</Eyebrow>
                  <code className="deploy-mono block text-base font-semibold">{source?.shortSha??(sourceWorking?t("loading"):t("sourceMissing"))}</code>
                  {source && <p className="max-w-[620px] text-xs leading-5 text-muted-foreground">{source.message}</p>}
                  {source?.committedAt && <p className="text-[11px] text-muted-foreground">
                    {t("commitDate",{date:new Date(source.committedAt).toLocaleDateString(locale)})}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={sourceWorking} onClick={()=>void reloadSource()}><RiRefreshLine/>{t("refresh")}</Button>
                  {source && <Button variant="outline" asChild><a href={source.url} target="_blank" rel="noopener noreferrer"><RiExternalLinkLine/>{t("viewCommit")}</a></Button>}
                </div>
              </div>
              <div className="space-y-2 rounded-none border border-border/70 p-4">
                <p className="text-sm font-semibold">{t("buildTitle")}</p>
                <p className="text-xs leading-5 text-muted-foreground">{t("buildDesc")}</p>
                {readiness && <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="outline">{localizeBuildStatus(locale,readiness.state)}</Badge>
                  <Badge variant="outline">{t("repoVerified")}: {t(readiness.verifiedRepoIdentity?"yes":"no")}</Badge>
                </div>}
                {readinessMessage && <p className="text-xs text-muted-foreground">{localizedStatus(readinessMessage)}</p>}
                {readiness?.safetyBlockers?.map((blocker,i)=><p key={i} className="text-xs text-muted-foreground">{localizeApiCopy(locale,blocker)}</p>)}
              </div>
              <div className="space-y-4 rounded-none border border-border/70 p-4">
                <div><p className="text-sm font-semibold">{t("planTitle")}</p><p className="text-xs text-muted-foreground">{t("planDesc")}</p></div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-full space-y-1.5 sm:w-52">
                    <label className="text-xs font-medium" htmlFor="intent-select">{t("operation")}</label>
                    <Select value={intent} onValueChange={v=>{setIntent(v as Intent);setPlan(null);setResourcePlan(null);setPreparedRun(null);}}>
                      <SelectTrigger id="intent-select" className="w-full"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="install">{t("install")}</SelectItem>
                        <SelectItem value="update">{t("update")}</SelectItem>
                        <SelectItem value="repair">{t("repair")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" disabled={!accountId||working} onClick={()=>void preview()}><RiInformationLine/>{working?t("working"):t("previewPlan")}</Button>
                  <Button variant="outline" disabled={!plan||preparing} onClick={()=>void freezeReviewedSha()}><RiGitBranchLine/>{preparing?t("working"):t("freezeSha")}</Button>
                </div>
                {plan ? <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Eyebrow>{t("sourceCommit")}</Eyebrow><code className="deploy-mono block text-xs">{plan.sourceSha}</code>
                    <Eyebrow>{t("planBlockers")}</Eyebrow>
                    {plan.blockers.length===0 && <Badge variant="secondary">{t("ready")}</Badge>}
                    {plan.blockers.map(x=><p key={x} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><RiAlertLine className="size-3.5 shrink-0"/>{localizeApiCopy(locale,x)}</p>)}
                  </div>
                  <div className="space-y-2"><Eyebrow>{t("planSteps")}</Eyebrow>
                    <ol className="space-y-2">{plan.proposedSteps.map((x,i)=><li className="flex gap-2 text-xs leading-5" key={i}><span className="text-primary">{i+1}.</span>{localizeApiCopy(locale,x)}</li>)}</ol>
                  </div>
                </div> : <p className="text-xs text-muted-foreground">{t("noPlan")}</p>}
                {preparedRun && <div className="space-y-2 rounded-none bg-muted/30 p-3 text-xs">
                  <p className="font-medium">{t("prepared")}</p>
                  <p className="text-muted-foreground">{t("preparedUntil",{time:new Date(preparedRun.expiresAt).toLocaleTimeString(locale)})}</p>
                  <code className="deploy-mono block">{preparedRun.pinnedSha}</code>
                  <p className="text-muted-foreground">{t("preparedHint")}</p>
                </div>}
                {resourcePlan && <div className="space-y-3 border-t border-border pt-3">
                  <p className="text-sm font-medium">{t("resourceActions")}</p>
                  <Badge variant="outline">{t("resourceBlockers",{count:resourcePlan.actions.filter(a=>a.disposition==="block").length})}</Badge>
                  {resourcePlan.blockers.map(x=><p key={x} className="text-xs text-destructive">{localizeApiCopy(locale,x)}</p>)}
                  <div className="grid gap-2 sm:grid-cols-2">{resourcePlan.actions.map(a=>
                    <div className="min-w-0 rounded-none border border-border/70 p-2.5 text-xs" key={a.binding}>
                      <code className="deploy-mono font-semibold">{a.binding}</code>
                      <Badge variant="outline">{localizeResourceDisposition(locale,a.disposition)}</Badge>
                      <p className="mt-1 text-muted-foreground">{localizeApiCopy(locale,a.description)}</p>
                    </div>)}</div>
                </div>}
              </div>
            </div>}
            {step===3 && <div className="space-y-5">
              {!installationSupported ? <Notice icon={<RiLockLine className="size-4"/>} title={t("installUnavailable")} text={t("installUnavailableHint")}/> : <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1 space-y-2">
                    <label htmlFor="d1-select" className="text-xs font-medium">{t("d1Label")}</label>
                    <Select value={databaseId} onValueChange={v=>{setDatabaseId(v);setD1Preview(null);setD1Message("");}}>
                      <SelectTrigger id="d1-select" className="w-full" disabled={!d1Databases.length}>
                        <SelectValue placeholder={t("d1Placeholder")}/>
                      </SelectTrigger>
                      <SelectContent>{d1Databases.map(db=><SelectItem value={db.uuid} key={db.uuid}>{db.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" disabled={!databaseId||d1Working||d1Applying} onClick={()=>void previewD1()}>
                    <RiShieldCheckLine/>{d1Working?t("verifyD1"):t("inspectMigrations")}
                  </Button>
                </div>
                {d1Message && <p role="status" className="text-xs leading-5 text-muted-foreground">{localizedStatus(d1Message)}</p>}
                {session.oauthConfigured && <div className="flex flex-wrap gap-3 text-xs">
                  <a href="/api/v1/auth/cloudflare/start?capability=d1-read" className="text-primary underline underline-offset-4">{t("authD1Read")}</a>
                  <a href="/api/v1/auth/cloudflare/start?capability=d1-write" className="text-primary underline underline-offset-4">{t("authD1Write")}</a>
                </div>}
                {d1Preview && <div className="space-y-4 rounded-none border border-border/80 p-4" data-testid="d1-preview">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="text-xs">{d1Preview.sourceSha.slice(0,12)}</code>
                    <Badge variant={d1Preview.pendingMigrations?"outline":"secondary"}>
                      {d1Preview.pendingMigrations ? d1Preview.pendingMigrations+" "+t("migrationPending") : t("schemaCurrent")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      [t("migrationTotal"),d1Preview.totalMigrations],
                      [t("migrationApplied"),d1Preview.appliedMigrations],
                      [t("migrationPending"),d1Preview.pendingMigrations],
                      [t("recoveryPoint"),t(d1Preview.recoveryBookmarkAvailable?"available":"missing")]
                    ].map(([label,value])=><div key={label} className="space-y-1 rounded-none bg-muted/25 p-3">
                      <p className="text-[11px] text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p>
                    </div>)}
                  </div>
                  {d1Preview.destructiveUpgrade && <Notice icon={<RiAlertLine className="size-4"/>} title={t("migrationReview")} text={t("migrationRisk")}/>}
                  {d1Preview.pending.length>0 && <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {d1Preview.pending.map(m=><div key={m.name} className="flex items-start gap-3 rounded-md border border-border/70 p-2.5 text-xs">
                      <Badge variant={m.destructive?"destructive":"outline"}>{t(m.destructive?"migrationReview":"migrationAdd")}</Badge>
                      <div className="min-w-0"><code className="deploy-mono block">{m.name}</code>
                        {m.warnings.map(w=><p key={w} className="mt-1 text-muted-foreground">{localizeApiCopy(locale,w)}</p>)}
                      </div>
                    </div>)}
                  </div>}
                  {d1Preview.blockers.map(b=><p key={b} className="text-xs text-destructive">{localizeApiCopy(locale,b)}</p>)}
                  {d1Applying && <div className="space-y-2" role="status">
                    <p className="text-xs">{t("d1Progress",{applied:migrationAppliedCount,remaining:Math.max(0,d1Preview.pendingMigrations-migrationAppliedCount)})}</p>
                    <div className="h-1.5 overflow-hidden rounded-none bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={d1Preview.pendingMigrations} aria-valuenow={migrationAppliedCount}>
                      <div className="h-full bg-primary transition-all duration-300" style={{width:Math.round((migrationAppliedCount/d1Preview.pendingMigrations)*100)+"%"}}/>
                    </div>
                  </div>}
                  {d1Preview.pendingMigrations>0 && <ConfirmOperation
                    title={t("confirmD1Title")}
                    description={t("actionConfirmD1",{count:d1Preview.pendingMigrations,target:d1Databases.find(db=>db.uuid===databaseId)?.name??databaseId})}
                    cancelText={t("cancel")} confirmText={t("confirm")}
                    onConfirm={()=>void applyD1Migrations()}>
                    <Button disabled={d1Applying||d1Working}>
                      <RiShieldCheckLine/>{d1Applying?t("applyingMigrations"):t("applyMigrations")}
                    </Button>
                  </ConfirmOperation>}
                  <p className="text-xs leading-5 text-muted-foreground">{t("d1ScopeHint")}</p>
                </div>}
              </>}
            </div>}
            {step===4 && <div className="space-y-5">
              {versionWorking && <div role="status" className="space-y-2"><p className="text-xs text-muted-foreground">{t("working")}</p><div className="h-1.5 overflow-hidden rounded-none bg-secondary"><div className="deploy-indeterminate h-full w-1/3 rounded-none bg-primary"/></div></div>}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!installationSupported||versionWorking} onClick={()=>void inspectWorkerVersions()}>
                  <RiInformationLine/>{versionWorking?t("working"):t("inspectVersion")}
                </Button>
                {session.oauthConfigured && <Button variant="outline" asChild>
                  <a href="/api/v1/auth/cloudflare/start?capability=deploy"><RiShieldCheckLine/>{t("authDeploy")}</a></Button>}
              </div>
              {versionMessage && <p role="status" className="text-xs leading-5 text-muted-foreground">{localizedStatus(versionMessage)}</p>}
              {versionPreview && <div className="space-y-4 rounded-none border border-border p-4" data-testid="worker-version-preview">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t("nightlyCandidate")}</p><Badge variant="outline">{t("inactive")}</Badge>
                </div>
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0"><p className="text-muted-foreground">{t("sourceCommit")}</p><code className="deploy-mono">{versionPreview.sourceSha}</code></div>
                  <div className="min-w-0"><p className="text-muted-foreground">{t("activeVersion")}</p><code className="deploy-mono">{versionPreview.expectedActiveVersionId}</code></div>
                  <div className="sm:col-span-2"><p className="text-muted-foreground">{t("migrationTag")}</p><code className="deploy-mono">{versionPreview.activeMigrationTag} → {versionPreview.targetMigrationTag}</code></div>
                </div>
                <p className="text-xs text-muted-foreground">{t("bindingsPreserved",{count:versionPreview.existingBindingsPreserved})}</p>
                {versionPreview.legacyAdoptionRequired && <label className="flex cursor-pointer items-start gap-3 rounded-none border border-border p-3 text-xs leading-5">
                  <Checkbox checked={legacyReviewed} onCheckedChange={checked=>setLegacyReviewed(checked===true)} className="mt-1"/>
                  {t("legacyApprove")}
                </label>}
                <div className="flex flex-wrap gap-2">
                  <ConfirmOperation title={t("confirmStageTitle")}
                    description={t("actionConfirmStage",{sha:versionPreview.sourceSha.slice(0,12)})}
                    cancelText={t("cancel")} confirmText={t("confirm")}
                    onConfirm={()=>void stageWorkerVersion()}>
                    <Button disabled={versionWorking || (versionPreview.legacyAdoptionRequired&&!legacyReviewed)}>
                      <RiShieldCheckLine/>{versionWorking?t("uploading"):t("uploadInactive")}
                    </Button>
                  </ConfirmOperation>
                  <Button variant="outline" disabled={versionWorking} onClick={()=>void findStagedVersions()}>
                    <RiRefreshLine/>{t("findPrevious")}
                  </Button>
                </div>
              </div>}
              {versionCandidates.length>0 && versionPreview && <div className="space-y-2 rounded-none border border-border p-4">
                <p className="text-sm font-semibold">{t("previousCandidates")}</p>
                {versionCandidates.map(candidate=><div key={candidate.stagedVersionId} className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-border/50 p-2">
                  <code className="deploy-mono max-w-full text-xs">{candidate.stagedVersionId}</code>
                  <Button variant="outline" disabled={versionWorking||(versionPreview.legacyAdoptionRequired&&!legacyReviewed)}
                    onClick={()=>setStagedVersion({stagedVersionId:candidate.stagedVersionId,sourceSha:candidate.sourceSha,
                      artifactDigest:candidate.artifactDigest,activeVersionUnchanged:true,bindingsVerified:true,migrationTagVerified:true,canPromote:false})}>{t("useCandidate")}</Button>
                </div>)}
              </div>}
              {stagedVersion && <Notice icon={<RiShieldCheckLine className="size-4"/>} title={t("stagedReady")} text={t("stageSafety")}/>}
              <p className="text-xs text-muted-foreground">{t("stageContinueHint")}</p>
            </div>}
            {step===5 && <div className="space-y-5">
              {activatedVersion ? <div className="space-y-3 rounded-none border border-primary/30 bg-primary/5 p-5" role="status">
                <div className="flex items-center gap-2 text-primary"><RiShieldCheckLine className="size-6"/><h3 className="text-lg font-semibold">{t("activationSuccess")}</h3></div>
                <div className="space-y-1 text-xs"><p>{t("deploymentId")}: <code className="deploy-mono">{activatedVersion.deploymentId}</code></p>
                  <p>{t("versionId")}: <code className="deploy-mono">{activatedVersion.activatedVersionId}</code></p></div>
              </div> : <>
                {!stagedVersion && <Notice icon={<RiInformationLine className="size-4"/>} title={t("activationNoCandidate")} text={t("stageContinueHint")}/>}
                {stagedVersion && <div className="space-y-3 rounded-none border border-border p-4" data-testid="worker-staged-version">
                  <p className="text-sm font-semibold">{t("activationTarget")}</p>
                  <code className="deploy-mono block text-xs">{stagedVersion.stagedVersionId}</code>
                  <p className="text-xs text-muted-foreground">{t("stageSafety")}</p>
                  {!d1Current && <Notice icon={<RiAlertLine className="size-4"/>} title={t("needsAttention")} text={t("activationNeedD1")}/>}
                  <ConfirmOperation destructive title={t("confirmActivateTitle")}
                    description={t("actionConfirmActivate",{version:stagedVersion.stagedVersionId})}
                    cancelText={t("cancel")} confirmText={t("confirm")}
                    onConfirm={()=>void activateWorkerVersion()}>
                    <Button variant="destructive" disabled={versionWorking||!d1Current||!versionPreview||(versionPreview.legacyAdoptionRequired&&!legacyReviewed)}>
                      <RiShieldCheckLine/>{versionWorking?t("working"):t("activate100")}
                    </Button>
                  </ConfirmOperation>
                </div>}
              </>}
              {versionMessage && <p role="status" className="text-xs text-muted-foreground">{versionMessage}</p>}
              <p className="text-xs text-muted-foreground">{t("activationNote")}</p>
            </div>}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={()=>goStep(step-1)} disabled={step===0||stageBusy}>
              <RiArrowLeftLine/>{t("previous")}
            </Button>
            {step<5 ? <Button onClick={()=>goStep(step+1)} disabled={!mayAdvance[step]||stageBusy}>
              {t("next")}<RiArrowRightLine/>
            </Button> : <Badge variant={activatedVersion?"secondary":"outline"}>{activatedVersion?t("stageFinish"):t("needsAttention")}</Badge>}
          </CardFooter>
        </Card>
        <footer className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-muted-foreground">
          <RiShieldCheckLine className="size-4 text-primary"/>{t("dataPromise")}
        </footer>
      </div>
    </main>
  </div>;
}
