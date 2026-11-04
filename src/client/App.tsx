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
type Intent = "install" | "update" | "repair";
type Plan = { intent: Intent; sourceSha: string; blockers: string[]; proposedSteps: string[]; allowed: boolean };
const labels: Record<Kind, string> = {
  "not-installed": "No installation", managed: "Managed",
  "legacy-candidate": "Existing instance — adoption required", conflict: "Worker name conflict"
};
const nav = [
  { title: "Overview", href: "#overview", Icon: RiLayoutGridLine },
  { title: "Source", href: "#source", Icon: RiGitBranchLine },
  { title: "Cloudflare account", href: "#account", Icon: RiCloudLine },
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
  const [intent,setIntent]=useState<Intent>("install");
  const [plan,setPlan]=useState<Plan|null>(null);
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
    if(!accountId){setDeployment(null);return;}
    let cancelled=false;
    setDeployment(null);
    setAccountMessage("Discovering installation…");
    void api<{deployment:Deployment}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/deployment")
      .then(v=>{if(!cancelled){setDeployment(v.deployment);setIntent(v.deployment.kind==="not-installed"?"install":"update");setAccountMessage("");}})
      .catch(e=>{if(!cancelled)setAccountMessage(errorText(e));});
    return ()=>{cancelled=true;};
  },[accountId]);

  async function preview(){
    if(!accountId)return;
    setWorking(true);setPlan(null);
    try{
      const r=await api<{plan:Plan}>("/api/v1/providers/cloudflare/accounts/"+accountId+"/plan?intent="+intent);
      setPlan(r.plan);
    }catch(e){setMessage(errorText(e));}
    finally{setWorking(false);}
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
        <Badge variant="outline">Preview · Read-only</Badge>
        <p className="text-xs leading-relaxed text-muted-foreground">Deployment execution is disabled until user-owned builds are verified.</p>
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
          <Metric caption="Build strategy" value="From source" note="One commit pinned per operation" Icon={RiCodeSSlashLine}/>
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

        <Card className="deploy-card" id="plan">
          <CardHeader><div className="flex justify-between gap-3">
            <div className="space-y-1"><Eyebrow>Deployment</Eyebrow><CardTitle>Deployment plan</CardTitle><CardDescription>Preview the exact steps without changing your infrastructure.</CardDescription></div>
            <RiTerminalBoxLine className="size-5 text-primary"/>
          </div></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-2 sm:w-52">
                <label htmlFor="intent-select" className="text-xs font-medium">Operation</label>
                <Select value={intent} onValueChange={v=>{setIntent(v as Intent);setPlan(null);}}>
                  <SelectTrigger className="w-full" id="intent-select"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="install">Install from main</SelectItem><SelectItem value="update">Update to main</SelectItem><SelectItem value="repair">Repair current commit</SelectItem></SelectContent>
                </Select>
              </div>
              <Button variant="outline" disabled={!deployment||working} onClick={()=>void preview()}><RiInformationLine/>{working?"Preparing…":"Preview plan"}</Button>
              <Button disabled><RiLockLine/>Execute unavailable</Button>
            </div>

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
