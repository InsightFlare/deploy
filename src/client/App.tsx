import { useEffect, useState, type ReactNode } from "react";
import {
  RiCloudLine, RiGitBranchLine, RiGithubLine, RiRefreshLine, RiLockLine,
  RiExternalLinkLine, RiLayoutGridLine, RiShieldCheckLine, RiCodeSSlashLine,
  RiServerLine, RiTerminalBoxLine, RiLogoutBoxRLine, RiInformationLine,
  RiAlertLine, RiTimeLine
} from "@remixicon/react";
import { Button } from "@insightflare/ui/button";
import { Badge } from "@insightflare/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@insightflare/ui/card";
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
const labels: Record<Kind, string> = {
  "not-installed": "No installation", managed: "Managed",
  "legacy-candidate": "Existing instance — adoption required", conflict: "Worker name conflict"
};
const nav = [
  { title: "Overview", href: "#overview", Icon: RiLayoutGridLine },
  { title: "Source", href: "#source", Icon: RiGitBranchLine },
  { title: "Cloudflare account", href: "#account", Icon: RiCloudLine },
  { title: "Build integration", href: "#build-readiness", Icon: RiCodeSSlashLine },
  { title: "D1 migration preview", href: "#database", Icon: RiServerLine },
  { title: "Deployment plan", href: "#plan", Icon: RiTerminalBoxLine }
];

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
function Metric({caption,value,note,Icon}: {
  caption: string; value: string; note: string; Icon: typeof RiCloudLine
}) {
  return <Card className="deploy-card py-4"><CardContent className="space-y-2">
    <div className="flex items-center justify-between"><Eyebrow>{caption}</Eyebrow><Icon className="size-4 text-muted-foreground"/></div>
    <p className="text-lg font-semibold">{value}</p><p className="text-xs text-muted-foreground">{note}</p>
  </CardContent></Card>;
}

export function App() {
  const [session,setSession]=useState<Session>({connected:false,oauthConfigured:false,expiresAt:null});
  const [source,setSource]=useState<Source|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [accountId,setAccountId]=useState("");
  const [deployment,setDeployment]=useState<Deployment|null>(null);
  const [readiness,setReadiness]=useState<BuildReadiness|null>(null);
  const [readinessMessage,setReadinessMessage]=useState("");
  const [d1Databases,setD1Databases]=useState<D1Database[]>([]);
  const [databaseId,setDatabaseId]=useState("");
  const [d1Preview,setD1Preview]=useState<D1Preview|null>(null);
  const [d1Message,setD1Message]=useState("");
  const [d1Working,setD1Working]=useState(false);
  const [d1Applying,setD1Applying]=useState(false);
  const [intent,setIntent]=useState<Intent>("install");
  const [plan,setPlan]=useState<Plan|null>(null);
  const [resourcePlan,setResourcePlan]=useState<ResourcePlan|null>(null);
  const [preparedRun,setPreparedRun]=useState<PreparedRun|null>(null);
  const [preparing,setPreparing]=useState(false);
  const [working,setWorking]=useState(false);
  const [sourceWorking,setSourceWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [accountMessage,setAccountMessage]=useState("");
  const [active,setActive]=useState("#overview");

  async function reloadSource(){
    setSourceWorking(true);
    try { setSource(await api<Source>("/api/v1/source/main")); }
    catch(e){ setMessage(errorText(e)); }
    finally { setSourceWorking(false); }
  }
  useEffect(()=>{
    const code = new URLSearchParams(window.location.search).get("error");
    if(code) setMessage("Cloudflare authorization failed: " + code);
    void reloadSource();
    void api<Session>("/api/v1/session").then(setSession).catch(e=>setMessage(errorText(e)));
  },[]);

  useEffect(()=>{
    if(!session.connected) return;
    let cancelled=false;
    setAccountMessage("Loading Cloudflare accounts…");
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
    setAccountMessage("Discovering installation…");
    void api<{deployment:Deployment}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/deployment")
      .then(v=>{if(!cancelled){setDeployment(v.deployment);setIntent(v.deployment.kind==="not-installed"?"install":"update");setAccountMessage("");}})
      .catch(e=>{if(!cancelled)setAccountMessage(errorText(e));});
    return ()=>{cancelled=true;};
  },[accountId]);

  useEffect(()=>{
    setReadiness(null);
    if(!accountId){setReadinessMessage("");return;}
    let cancelled=false;
    setReadinessMessage("Inspecting user-side build configuration…");
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
    setD1Databases([]);setDatabaseId("");setD1Preview(null);setD1Message("");
    if(!session.connected||!accountId) return;
    let cancelled=false;
    setD1Message("Loading D1 databases from the selected account…");
    void api<{databases:D1Database[]}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/d1/databases")
      .then(v=>{if(!cancelled){setD1Databases(v.databases);setD1Message(v.databases.length?"":"No D1 databases found in this account.");}})
      .catch(e=>{if(!cancelled)setD1Message(errorText(e));});
    return ()=>{cancelled=true;};
  },[session.connected,accountId]);

  async function applyD1Migrations(){
    if(!accountId || !databaseId || !d1Preview || d1Applying ||
       !d1Preview.pendingMigrations || !d1Preview.migrationExecutionAvailable) return;
    const target = d1Databases.find(db=>db.uuid===databaseId)?.name ?? databaseId;
    if(!window.confirm("Apply "+d1Preview.pendingMigrations+" official D1 migrations to "+
      target+"? As with manual Wrangler deployment, the existing Worker continues serving during migrations.")) return;
    setD1Applying(true);setD1Message("");
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
        remaining=progress.remaining;
        digest=progress.nextReviewedPlanDigest;
        setD1Message("Applied "+applied+" migration(s); "+remaining+" remaining.");
      }
      if(remaining>0) throw new Error("Migration process stopped; refresh the preview.");
      const updated=await api<{preview:D1Preview}>(
        "/api/v1/providers/cloudflare/accounts/"+accountId+
        "/d1/migration-preview?databaseId="+encodeURIComponent(databaseId)
      );
      setD1Preview(updated.preview);
      setD1Message("All D1 migrations have been applied; Worker deployment is a separate step.");
    }catch(e){
      setD1Message(errorText(e)+" Check the latest D1 migration history before continuing.");
    }finally{setD1Applying(false);}
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

  return <div className="deploy-shell flex min-h-screen flex-col md:flex-row">
    <aside className="deploy-sidebar flex w-full shrink-0 flex-col border-b border-sidebar-border px-5 py-6 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <a href="#overview" className="mb-5 flex items-center gap-3 md:mb-12">
        <span className="deploy-mark flex size-9 items-center justify-center"><RiLayoutGridLine className="size-5"/></span>
        <span className="font-semibold tracking-tight">InsightFlare <span className="font-normal text-muted-foreground">Deploy</span></span>
      </a>
      <div className="hidden px-3 pb-3 md:block"><Eyebrow>Workspace</Eyebrow></div>
      <nav aria-label="Control plane" className="flex flex-wrap gap-1 md:flex-col">
        {nav.map(({title,href,Icon})=>
          <a key={href} href={href} data-active={active===href}
            onClick={()=>setActive(href)}
            className="deploy-nav flex min-h-9 items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground transition-colors">
            <Icon className="size-4"/><span>{title}</span>
          </a>)}
      </nav>
      <div className="mt-6 space-y-3 border-t border-sidebar-border pt-5 md:mt-auto">
        <Badge variant="outline">Nightly · D1 migrations</Badge>
        <p className="text-xs leading-relaxed text-muted-foreground">Official Nightly and D1 migrations are available. Worker upload and activation remain separate.</p>
        <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          href="https://github.com/InsightFlare/deploy" target="_blank" rel="noopener noreferrer">
          Source code <RiExternalLinkLine className="size-3.5"/>
        </a>
      </div>
    </aside>

    <div className="deploy-main min-w-0 flex-1">
      <header className="flex h-16 items-center justify-between border-b border-border px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Control plane</span><span className="text-muted-foreground/50">/</span>Overview</div>
        <div className="flex items-center gap-3"><span className="hidden text-[10px] font-semibold tracking-widest text-muted-foreground sm:inline">CLOUDFLARE</span>
          <Badge variant={session.connected?"secondary":"outline"}>{session.connected?"Connected":"Not connected"}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:px-8 lg:px-12" id="overview">
        <section className="space-y-5 pb-3">
          <Badge variant="outline"><RiCloudLine className="mr-1 size-3"/>DEPLOYMENT CONTROL PLANE</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Own the deployment.<br/><span className="text-primary">Own your analytics.</span></h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">Connect your Cloudflare account, inspect your InsightFlare instance, and preview updates pinned to the official upstream <code className="bg-muted px-1.5 text-foreground">main</code> commit.</p>
          <div className="flex flex-wrap gap-3">
            {session.connected ?
              <Button size="lg" asChild><a href="#account"><RiCloudLine/>View Cloudflare account</a></Button> :
              session.oauthConfigured ?
                <Button size="lg" asChild><a href="/api/v1/auth/cloudflare/start"><RiCloudLine/>Connect Cloudflare</a></Button> :
                <Button size="lg" disabled><RiLockLine/>Cloudflare OAuth not configured</Button>}
            <Button size="lg" variant="outline" asChild><a href="https://github.com/RavelloH/InsightFlare" target="_blank" rel="noopener noreferrer"><RiGithubLine/>View InsightFlare<RiExternalLinkLine/></a></Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><RiShieldCheckLine className="size-4"/>No infrastructure changes are possible in this preview.</div>
        </section>

        {message&&<div role="alert" className="flex items-start justify-between gap-3 border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs">
          <span className="flex items-center gap-2"><RiAlertLine className="size-4 shrink-0 text-destructive"/>{message}</span>
          <Button size="xs" variant="ghost" onClick={()=>setMessage("")}>Dismiss</Button>
        </div>}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Status overview">
          <Metric caption="Source branch" value="main" note="Official upstream repository" Icon={RiGitBranchLine}/>
          <Metric caption="Build strategy" value="Official Nightly" note="Verified archive pinned to a main commit" Icon={RiCodeSSlashLine}/>
          <Metric caption="Control plane" value="Read-only" note="Infrastructure changes disabled" Icon={RiShieldCheckLine}/>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="deploy-card min-w-0" id="source">
            <CardHeader><div className="flex items-start justify-between gap-3">
              <div className="space-y-1"><Eyebrow>Repository</Eyebrow><CardTitle>Upstream main</CardTitle><CardDescription>Source for new installs and updates</CardDescription></div>
              <RiGitBranchLine className="size-5 text-primary"/>
            </div></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium">RavelloH <span className="text-muted-foreground">/</span> InsightFlare</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <code data-testid="source-sha" className="deploy-mono bg-secondary px-3 py-2 text-sm">{source?.shortSha??(sourceWorking?"Loading…":"Unavailable")}</code>
                {source&&<a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">View commit<RiExternalLinkLine className="size-3"/></a>}
              </div>
              <p className="min-h-8 text-xs leading-relaxed text-muted-foreground">{source?.message??"Read latest main commit from GitHub."}</p>
              <Separator/>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{source?.committedAt?"Committed "+new Date(source.committedAt).toLocaleDateString():"Immutable source commit"}</span>
                <Button variant="ghost" size="sm" disabled={sourceWorking} onClick={()=>void reloadSource()}><RiRefreshLine/>Refresh</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="deploy-card min-w-0" id="account">
            <CardHeader><div className="flex items-start justify-between gap-3">
              <div className="space-y-1"><Eyebrow>Cloudflare</Eyebrow><CardTitle>Managed account</CardTitle><CardDescription>Discover an instance from your own account</CardDescription></div>
              <RiCloudLine className="size-5 text-primary"/>
            </div></CardHeader>
            <CardContent className="space-y-4">
              {!session.connected ? <div className="flex min-h-40 flex-col justify-center gap-3">
                <RiServerLine className="size-7 text-muted-foreground"/>
                <p className="text-sm font-medium">No account connected</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">Connect Cloudflare to inspect an existing InsightFlare instance.</p>
              </div> : <>
                <label className="block text-xs font-medium" htmlFor="account-select">Cloudflare account</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-full" id="account-select" disabled={!accounts.length}><SelectValue placeholder="Choose an account"/></SelectTrigger>
                  <SelectContent>{accounts.map(account=><SelectItem value={account.id} key={account.id}>{account.name||account.id}</SelectItem>)}</SelectContent>
                </Select>
                {accountMessage&&<p role="status" className="text-xs text-muted-foreground">{accountMessage}</p>}
                {deployment&&<div className="space-y-3 border border-border bg-muted/20 p-3 text-xs">
                  <Badge variant={deployment.kind==="managed"?"secondary":"outline"}>{labels[deployment.kind]}</Badge>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Worker</span><code>{deployment.workerName}</code></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Deployed SHA</span><code>{deployment.deployedSha?.slice(0,8)||"Unknown"}</code></div>
                  {deployment.issues.map(issue=><p className="text-muted-foreground" key={issue}>{issue}</p>)}
                </div>}
                <Button size="sm" variant="ghost" onClick={()=>void disconnect()}><RiLogoutBoxRLine/>Disconnect</Button>
              </>}
            </CardContent>
          </Card>
        </div>

        <Card className="deploy-card" id="build-readiness">
          <CardHeader><div className="flex items-start justify-between gap-3">
            <div className="space-y-1"><Eyebrow>Source builds</Eyebrow><CardTitle>Build integration</CardTitle><CardDescription>Read-only inspection of Cloudflare Workers Builds settings</CardDescription></div>
            <RiCodeSSlashLine className="size-5 text-primary"/>
          </div></CardHeader>
          <CardContent className="space-y-3">
            {readiness ? <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">{readiness.state.replaceAll("-", " ")}</Badge>
                <span className="text-xs text-muted-foreground">{readiness.candidateTriggerCount} upstream candidate(s) / {readiness.triggerCount} trigger(s)</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{readiness.message}</p>
              {readiness.repoConnectedToUpstream && <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Repo ID: {readiness.verifiedRepoIdentity?"Verified":"Unverified"}</Badge>
                <Badge variant="outline">Stage only: {readiness.canStageWithoutPromotion?"Yes":"No"}</Badge>
                {readiness.automaticPushBuildPossible && <Badge variant="outline">Upstream pushes may trigger builds</Badge>}
              </div>}
              {readiness.safetyBlockers?.map((blocker,i)=><p key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><RiAlertLine className="mt-0.5 size-3.5 shrink-0"/>{blocker}</p>)}
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLockLine className="size-4"/>Build execution remains disabled until permissions, provenance and migration safety are validated.</p>
            </> : <p className="text-xs leading-relaxed text-muted-foreground">{readinessMessage || "Connect Cloudflare and select an account to inspect its build integration."}</p>}
          </CardContent>
        </Card>

        <Card className="deploy-card" id="database">
          <CardHeader><div className="flex items-start justify-between gap-3">
            <div className="space-y-1"><Eyebrow>Database</Eyebrow><CardTitle>D1 migration readiness</CardTitle>
              <CardDescription>Inspect the official Nightly migrations, then apply pending SQL like Wrangler. The existing Worker keeps serving.</CardDescription></div>
            <RiServerLine className="size-5 text-primary"/>
          </div></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-2 sm:w-80">
                <label htmlFor="d1-select" className="text-xs font-medium">D1 database</label>
                <Select value={databaseId} onValueChange={v=>{setDatabaseId(v);setD1Preview(null);setD1Message("");}}>
                  <SelectTrigger className="w-full" id="d1-select" disabled={!session.connected||!d1Databases.length}>
                    <SelectValue placeholder="Choose a database"/>
                  </SelectTrigger>
                  <SelectContent>{d1Databases.map(db=><SelectItem key={db.uuid} value={db.uuid}>
                    {db.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="outline" disabled={!databaseId||d1Working||d1Applying} onClick={()=>void previewD1()}>
                <RiShieldCheckLine/>{d1Working?"Verifying Nightly and D1…":"Inspect migrations"}
              </Button>
              <Badge variant="outline">Wrangler-compatible migrations</Badge>
            </div>
            {d1Message&&<p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground" role="status">
              <RiInformationLine className="mt-0.5 size-4 shrink-0"/>{d1Message}
            </p>}
            {session.oauthConfigured&&d1Message.includes("D1 access denied")&&<div className="space-y-2 border border-border bg-muted/10 p-3">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/v1/auth/cloudflare/start?capability=d1-read"><RiShieldCheckLine/>Authorize D1 Read</a>
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This requires explicit Cloudflare consent. The OAuth client must also allow the <code>d1.read</code> scope; no D1 Write permission is requested for inspection.
              </p>
            </div>}
            {d1Preview&&<div className="space-y-3 border border-border p-4" data-testid="d1-preview">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Eyebrow>Verified source {d1Preview.sourceSha.slice(0,12)}</Eyebrow>
                <Badge variant={d1Preview.pendingMigrations?"outline":"secondary"}>
                  {d1Preview.pendingMigrations?d1Preview.pendingMigrations+" pending":"Schema current"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div><p className="text-muted-foreground">Official SQL files</p><p className="mt-1 text-base font-semibold">{d1Preview.totalMigrations}</p></div>
                <div><p className="text-muted-foreground">Applied</p><p className="mt-1 text-base font-semibold">{d1Preview.appliedMigrations}</p></div>
                <div><p className="text-muted-foreground">Pending</p><p className="mt-1 text-base font-semibold">{d1Preview.pendingMigrations}</p></div>
                <div><p className="text-muted-foreground">Recovery point</p><p className="mt-1 font-medium">{d1Preview.recoveryBookmarkAvailable?"Available":"Missing"}</p></div>
              </div>

              {d1Preview.destructiveUpgrade&&<p className="flex items-start gap-2 text-xs text-destructive">
                <RiAlertLine className="mt-0.5 size-4 shrink-0"/>Some migrations change existing schema or data. As with manual deployment, old Worker requests can continue during the change; verify compatibility before applying.
              </p>}
              {d1Preview.pending.length>0&&<div className="max-h-56 space-y-2 overflow-y-auto">
                {d1Preview.pending.map(item=><div key={item.name} className="flex items-start gap-3 border border-border/70 p-2.5 text-xs">
                  <Badge variant={item.destructive?"destructive":"outline"}>{item.destructive?"Review":"Add"}</Badge>
                  <div className="min-w-0"><code className="deploy-mono break-all">{item.name}</code>
                    {item.warnings.map(w=><p key={w} className="mt-1 text-muted-foreground">{w}</p>)}
                  </div>
                </div>)}
              </div>}
              {d1Preview.blockers.map(blocker=><p key={blocker} className="flex items-start gap-2 text-xs text-muted-foreground">
                <RiLockLine className="mt-0.5 size-3.5 shrink-0"/>{blocker}
              </p>)}
              {d1Preview.pendingMigrations>0&&<div className="flex flex-wrap items-center gap-3 pt-2">
                <Button disabled={d1Applying||d1Working} onClick={()=>void applyD1Migrations()}>
                  <RiShieldCheckLine/>{d1Applying?"Applying migrations…":"Apply pending D1 migrations"}
                </Button>
                {session.oauthConfigured&&<a href="/api/v1/auth/cloudflare/start?capability=d1-write"
                  className="text-xs text-primary underline underline-offset-4">Authorize D1 Write</a>}
              </div>}
              <p className="text-xs text-muted-foreground">
                Migration files are applied in Wrangler order without pausing the existing Worker.
                Failed SQL stops at the failing file. Worker upload and activation are separate.
              </p>
            </div>}
          </CardContent>
        </Card>

        <Card className="deploy-card" id="plan">
          <CardHeader><div className="flex justify-between gap-3">
            <div className="space-y-1"><Eyebrow>Deployment</Eyebrow><CardTitle>Deployment plan</CardTitle><CardDescription>Preview the exact steps without changing your infrastructure.</CardDescription></div>
            <RiTerminalBoxLine className="size-5 text-primary"/>
          </div></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-2 sm:w-52">
                <label htmlFor="intent-select" className="text-xs font-medium">Operation</label>
                <Select value={intent} onValueChange={v=>{setIntent(v as Intent);setPlan(null);setResourcePlan(null);setPreparedRun(null);}}>
                  <SelectTrigger className="w-full" id="intent-select"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="install">Install from main</SelectItem><SelectItem value="update">Update to main</SelectItem><SelectItem value="repair">Repair current commit</SelectItem></SelectContent>
                </Select>
              </div>
              <Button variant="outline" disabled={!deployment||working} onClick={()=>void preview()}><RiInformationLine/>{working?"Preparing…":"Preview plan"}</Button>
              <Button variant="outline" disabled={!plan||preparing} onClick={()=>void freezeReviewedSha()}><RiGitBranchLine/>{preparing?"Freezing…":"Freeze reviewed SHA"}</Button>
              <Button disabled><RiLockLine/>Execute unavailable</Button>
            </div>

            {preparedRun && <div className="space-y-2 border border-border bg-muted/20 p-4" role="status">
              <div className="flex items-center justify-between gap-2"><Eyebrow>Prepared operation · No deployment</Eyebrow><Badge variant="outline">Blocked</Badge></div>
              <p className="text-xs text-muted-foreground">This SHA is frozen for the current session until {new Date(preparedRun.expiresAt).toLocaleTimeString()}.</p>
              <code data-testid="prepared-sha" className="deploy-mono block text-xs text-foreground">{preparedRun.pinnedSha}</code>
              <p className="text-xs text-muted-foreground">Preparation does not start a build, migrate a database or modify your Cloudflare resources.</p>
            </div>}
            {resourcePlan && <div className="space-y-3 border border-border bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow>Resource reconciliation · Preview only</Eyebrow>
                <Badge variant="outline">{resourcePlan.actions.filter(x=>x.disposition==="block").length} resource blockers</Badge>
              </div>
              {resourcePlan.blockers.map(x=><p className="flex items-start gap-2 text-xs text-destructive" key={x}><RiAlertLine className="size-3.5 shrink-0"/>{x}</p>)}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {resourcePlan.actions.map(action=><div key={action.binding} className="flex items-start gap-3 border border-border/70 p-2.5 text-xs">
                  <Badge variant={action.disposition==="block"?"destructive":"outline"}>{action.disposition}</Badge>
                  <div className="min-w-0 space-y-1"><code className="deploy-mono text-foreground">{action.binding}</code><p className="leading-relaxed text-muted-foreground">{action.description}</p></div>
                </div>)}
              </div>
            </div>}
            {plan ? <div className="grid grid-cols-1 gap-5 border border-border p-4 md:grid-cols-2">
              <div className="space-y-3">
                <Eyebrow>Target commit</Eyebrow>
                <code className="deploy-mono block text-xs">{plan.sourceSha}</code>
                <Badge variant="outline"><RiLockLine className="mr-1 size-3"/>Execution gated</Badge>
                {plan.blockers.map(blocker=><p key={blocker} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><RiAlertLine className="mt-0.5 size-3.5 shrink-0"/>{blocker}</p>)}
              </div><div className="space-y-3">
                <Eyebrow>Planned steps</Eyebrow>
                <ol className="space-y-2">{plan.proposedSteps.map((step,i)=><li key={step} className="flex gap-3 text-xs text-muted-foreground"><span className="text-primary">{String(i+1).padStart(2,"0")}</span>{step}</li>)}</ol>
              </div>
            </div> : <div className="flex min-h-28 items-center justify-center gap-3 border border-dashed border-border px-4 text-center text-xs text-muted-foreground">
              <RiTimeLine className="size-5 shrink-0"/>{working?"Preparing read-only plan…":"Connect Cloudflare and select an account to preview the deployment plan."}
            </div>}
          </CardContent>
        </Card>

        <footer className="flex flex-col justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row">
          <span>InsightFlare Deploy · Independent control plane</span>
          <span className="flex items-center gap-2"><RiShieldCheckLine className="size-4 text-primary"/>Your analytics data stays in your account</span>
        </footer>
      </main>
    </div>
  </div>;
}
