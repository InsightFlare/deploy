const TRACKER_URL = "https://insight.ravelloh.com/script.js?siteId=92fc3d90-965a-45df-b48e-2db4b0e76855";
const OAUTH_PENDING = "ifd:analytics:oauth-pending";
const PLAN_DEDUPE_MS = 30 * 60_000;

type EventProperties = Record<string, string>;
type Tracker = { track(name: string, properties?: EventProperties): void };
type AnalyticsWindow = Window & { insightflare?: Tracker };

const recordedPlans = new Map<string, number>();
let pending: Array<{ name: string; properties?: EventProperties }> | undefined;

function tracker() {
  return (window as AnalyticsWindow).insightflare;
}

function send(name: string, properties?: EventProperties) {
  try { tracker()?.track(name, properties); } catch { /* Analytics cannot affect deployment. */ }
}

export function initAnalytics() {
  if (window.location.hostname !== "deploy.insightflare.net") return;
  const events: NonNullable<typeof pending> = [];
  pending = events;
  const script = document.createElement("script");
  script.src = TRACKER_URL;
  script.async = true;
  script.addEventListener("load", () => {
    pending = undefined;
    for (const { name, properties } of events) send(name, properties);
  }, { once: true });
  script.addEventListener("error", () => { pending = undefined; }, { once: true });
  document.head.appendChild(script);
}

export function track(name: string, properties?: EventProperties) {
  if (pending) pending.push({ name, properties });
  else send(name, properties);
}

export function trackPlan(mode: "install" | "update" | "configure" | "uninstall", accountId: string, artifactDigest: string) {
  if (window.location.hostname !== "deploy.insightflare.net") return;
  const key = `ifd:analytics:plan:${mode}:${accountId}:${artifactDigest}`;
  const now = Date.now();
  const cutoff = now - PLAN_DEDUPE_MS;
  if ((recordedPlans.get(key) ?? 0) > cutoff) return;
  recordedPlans.set(key, now);
  try {
    if (Number(window.sessionStorage.getItem(key)) > cutoff) return;
    window.sessionStorage.setItem(key, String(now));
  } catch { /* The in-memory record still covers wizard navigation. */ }
  track(`deploy_${mode}_plan_ready`);
}

export function trackOAuthStart() {
  if (window.location.hostname !== "deploy.insightflare.net") return;
  try { window.sessionStorage.setItem(OAUTH_PENDING, "1"); } catch { /* Storage may be blocked. */ }
  track("deploy_oauth_started");
}

export function trackOAuthCallback(connected: boolean) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("error") && params.get("connected") !== "1") return;
  try {
    if (!window.sessionStorage.getItem(OAUTH_PENDING)) return;
    window.sessionStorage.removeItem(OAUTH_PENDING);
  } catch { return; }
  if (connected && params.get("connected") === "1") track("deploy_oauth_connected");
}
