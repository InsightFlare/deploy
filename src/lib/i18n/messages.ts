// @generated from src/i18n/*.yaml by scripts/generate-i18n.mjs.
import type { Locale } from "./config";

export interface AppMessages {
  "deploy": {
    "brand": string;
    "tagline": string;
    "wizard": string;
    "wizardHelp": string;
    "language": string;
    "theme": string;
    "lightTheme": string;
    "darkTheme": string;
    "systemTheme": string;
    "connected": string;
    "disconnected": string;
    "stepCount": string;
    "progress": string;
    "back": string;
    "next": string;
    "dismiss": string;
    "loading": string;
    "refresh": string;
    "copy": string;
    "copied": string;
    "details": string;
    "unexpectedError": string;
    "httpError": string;
    "stepConnect": string;
    "stepAccount": string;
    "stepReview": string;
    "stepDeploy": string;
    "stepDone": string;
    "connectTitle": string;
    "connectDesc": string;
    "connectButton": string;
    "oauthMissing": string;
    "connectedDesc": string;
    "disconnect": string;
    "dataPromise": string;
    "permissionsTitle": string;
    "permissionsBody": string;
    "authFailed": string;
    "accountTitle": string;
    "accountDesc": string;
    "accountLabel": string;
    "accountPlaceholder": string;
    "discovering": string;
    "kindNotInstalled": string;
    "kindManaged": string;
    "kindLegacy": string;
    "kindConflict": string;
    "deployedCommit": string;
    "resumeRun": string;
    "reviewTitle": string;
    "reviewDesc": string;
    "sourceCommit": string;
    "viewCommit": string;
    "installPlanTitle": string;
    "planWorker": string;
    "planDatabaseCreate": string;
    "planDatabaseReuse": string;
    "planKvCreate": string;
    "planKvReuse": string;
    "planMigrations": string;
    "planCrons": string;
    "planUrl": string;
    "planNoWorkersDev": string;
    "planSecrets": string;
    "planAnalytics": string;
    "planAnalyticsNote": string;
    "enableAnalyticsEngine": string;
    "updatePlanTitle": string;
    "updateFromTo": string;
    "unknownVersion": string;
    "updatePendingMigrations": string;
    "updateNoMigrations": string;
    "updateDestructive": string;
    "updateDoMigration": string;
    "updateSafety": string;
    "legacyAdopt": string;
    "upToDate": string;
    "upToDateReaderMissing": string;
    "planAnalyticsReader": string;
    "note_AE_READER_PRESENT": string;
    "readerScopeMissingTitle": string;
    "readerScopeMissingBody": string;
    "reauthorize": string;
    "note_AE_READER_NOT_AUTHORIZED": string;
    "upToDateAeOff": string;
    "planEnableAnalytics": string;
    "aeStatusLabel": string;
    "aeStatus_configured": string;
    "aeStatus_missing": string;
    "aeStatus_switched_off": string;
    "aeStatus_not_bound": string;
    "aeDisabledTitle": string;
    "aeDisabledInstallBody": string;
    "aeDisabledUpdateBody": string;
    "recheck": string;
    "blockersTitle": string;
    "blocker_WORKER_CONFLICT": string;
    "blocker_NIGHTLY_PENDING": string;
    "blocker_RELEASE_UNAVAILABLE": string;
    "blocker_DATABASE_TAKEN": string;
    "blocker_UPDATE_BLOCKED": string;
    "adminPasswordTitle": string;
    "adminPasswordGenerate": string;
    "adminPasswordCustom": string;
    "adminPasswordLabel": string;
    "adminPasswordRepeat": string;
    "adminPasswordHint": string;
    "adminPasswordTooShort": string;
    "adminPasswordMismatch": string;
    "adminCustomDesc": string;
    "installButton": string;
    "updateButton": string;
    "confirmInstallTitle": string;
    "confirmInstallDesc": string;
    "confirmUpdateTitle": string;
    "confirmUpdateDesc": string;
    "confirm": string;
    "cancel": string;
    "deployTitle": string;
    "deployDesc": string;
    "runStep_verify": string;
    "runStep_database": string;
    "runStep_kv": string;
    "runStep_migrate": string;
    "runStep_worker": string;
    "runStep_schedules": string;
    "runStep_subdomain": string;
    "runStep_analytics": string;
    "runStep_health": string;
    "runStep_stage": string;
    "runStep_activate": string;
    "statusPending": string;
    "statusRunning": string;
    "statusDone": string;
    "statusSkipped": string;
    "statusWarning": string;
    "statusFailed": string;
    "note_CREATED": string;
    "note_REUSED": string;
    "note_MIGRATIONS": string;
    "note_CRONS": string;
    "note_URL": string;
    "note_AE_NOT_ENABLED": string;
    "note_AE_ENABLED": string;
    "note_AE_READER_CONFIGURED": string;
    "note_AE_READER_MANUAL": string;
    "note_WORKERS_DEV_MISSING": string;
    "note_NO_PUBLIC_URL": string;
    "note_HEALTHY": string;
    "note_WAITING": string;
    "note_HEALTH_TIMEOUT": string;
    "note_ALREADY_CURRENT": string;
    "note_ROLLED_BACK": string;
    "runFailedTitle": string;
    "runFailedDesc": string;
    "runSourceMovedDesc": string;
    "rolledBackDesc": string;
    "retry": string;
    "startOver": string;
    "otherTab": string;
    "reconnectNeeded": string;
    "doneInstallTitle": string;
    "doneUpdateTitle": string;
    "doneDesc": string;
    "openDashboard": string;
    "adminTitle": string;
    "adminDesc": string;
    "username": string;
    "password": string;
    "passwordSaved": string;
    "passwordForgotten": string;
    "followUpTitle": string;
    "followAeEnable": string;
    "followAeReader": string;
    "followWorkersDev": string;
    "followHealth": string;
    "openCloudflare": string;
    "finish": string;
    "updateSafetyConfigure": string;
    "confirmUpdateNoMigrationDesc": string;
    "confirmConfigureTitle": string;
    "confirmConfigureDesc": string;
    "configureButton": string;
    "domainTitle": string;
    "domainCurrent": string;
    "domainUseWorkersDev": string;
    "domainKeep": string;
    "domainUseCustom": string;
    "domainAddCustom": string;
    "domainSubdomain": string;
    "domainZone": string;
    "domainZonePlaceholder": string;
    "domainHint": string;
    "domainPreview": string;
    "domainAlready": string;
    "domainInvalid": string;
    "planDomain": string;
    "runStep_domain": string;
    "note_DOMAIN_ATTACHED": string;
    "note_DOMAIN_FAILED": string;
    "followDomain": string;
    "domainNoZones": string;
    "domainZonesError": string;
    "uninstallTitle": string;
    "uninstallReviewDesc": string;
    "uninstallButton": string;
    "uninstallCleanup": string;
    "uninstallConfirmTitle": string;
    "uninstallWarning": string;
    "uninstallResources": string;
    "uninstallResidual": string;
    "uninstallTypeName": string;
    "uninstallRunning": string;
    "uninstallDoneTitle": string;
    "uninstallDoneDesc": string;
    "uninstallFailedDesc": string;
    "runStep_removeWorker": string;
    "runStep_removeDatabase": string;
    "runStep_removeKv": string;
    "runStep_verifyRemoval": string;
    "runStep_removeDomains": string;
  };
};
const enMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "Your analytics, your Cloudflare account.",
    "wizard": "Deployment assistant",
    "wizardHelp": "Install or update InsightFlare in your own Cloudflare account with one click. Everything runs with your authorization and can be resumed if interrupted.",
    "language": "Language",
    "theme": "Theme",
    "lightTheme": "Light",
    "darkTheme": "Dark",
    "systemTheme": "System",
    "connected": "Connected",
    "disconnected": "Not connected",
    "stepCount": "Step {current} of {total}",
    "progress": "Progress",
    "back": "Back",
    "next": "Continue",
    "dismiss": "Dismiss",
    "loading": "Loading…",
    "refresh": "Refresh",
    "copy": "Copy",
    "copied": "Copied",
    "details": "Details",
    "unexpectedError": "Something went wrong. Please retry.",
    "httpError": "Request failed (HTTP {status}).",
    "stepConnect": "Connect",
    "stepAccount": "Account",
    "stepReview": "Review",
    "stepDeploy": "Deploy",
    "stepDone": "Done",
    "connectTitle": "Connect your Cloudflare account",
    "connectDesc": "Sign in with Cloudflare and approve the permissions InsightFlare needs to install itself into your account.",
    "connectButton": "Connect with Cloudflare",
    "oauthMissing": "Cloudflare sign-in is not configured for this service yet.",
    "connectedDesc": "Your Cloudflare authorization is active until {time}.",
    "disconnect": "Disconnect",
    "dataPromise": "Your analytics data never leaves your Cloudflare account.",
    "permissionsTitle": "What this authorization allows",
    "permissionsBody": "Create and update the insightflare Worker, its D1 database and KV namespace, and create one read-only Analytics Engine token. On the Cloudflare consent page, \"API Tokens\" is not ticked by default: tick it so the token can be created for you. The authorization expires within an hour and is never stored in plain text.",
    "authFailed": "Cloudflare sign-in did not complete ({error}). Please try again.",
    "accountTitle": "Choose an account",
    "accountDesc": "We look for an existing InsightFlare installation in the account you pick.",
    "accountLabel": "Cloudflare account",
    "accountPlaceholder": "Select an account",
    "discovering": "Checking the account…",
    "kindNotInstalled": "Not installed yet",
    "kindManaged": "Installed",
    "kindLegacy": "Installed (set up before Deploy)",
    "kindConflict": "Name conflict",
    "deployedCommit": "Running commit {sha}",
    "resumeRun": "A deployment for this account is in progress or needs your attention. Continue to see it.",
    "reviewTitle": "Review the plan",
    "reviewDesc": "Nothing changes until you confirm. The plan is pinned to the official build shown below.",
    "sourceCommit": "Official build",
    "viewCommit": "View commit",
    "installPlanTitle": "We will create",
    "planWorker": "Worker {name}, with its Durable Object and static assets",
    "planDatabaseCreate": "D1 database {name}",
    "planDatabaseReuse": "Use the existing empty D1 database {name}",
    "planKvCreate": "KV namespace {name}",
    "planKvReuse": "Use the existing KV namespace {name}",
    "planMigrations": "{count} database migrations",
    "planCrons": "Scheduled task {list}",
    "planUrl": "Public address {url}",
    "planNoWorkersDev": "This account has no workers.dev subdomain yet. InsightFlare will be installed, but you need to add a domain or register workers.dev afterwards.",
    "planSecrets": "A random root secret, generated for you",
    "planAnalytics": "Analytics Engine datasets",
    "planAnalyticsNote": "Analytics Engine is enabled on this account, so its datasets are bound and a read-only token is created for InsightFlare.",
    "enableAnalyticsEngine": "Open Analytics Engine",
    "updatePlanTitle": "We will update",
    "updateFromTo": "From {from} to {to}",
    "unknownVersion": "an unrecorded version",
    "updatePendingMigrations": "{count} database migrations to apply",
    "updateNoMigrations": "No database migrations needed",
    "updateDestructive": "Some migrations change or remove existing tables. Make sure you have a recent backup.",
    "updateDoMigration": "Includes a Durable Object migration",
    "updateSafety": "The new version is uploaded first and only switched on after the database is ready. If it fails its health check, the previous version is restored automatically.",
    "legacyAdopt": "This installation was set up before InsightFlare Deploy. I agree to let Deploy manage it from now on; its data, secrets and bindings are kept.",
    "upToDate": "This installation already runs the latest official build. You can still add a custom domain below.",
    "upToDateReaderMissing": "This installation already runs the latest official build, but Analytics Engine reading is not configured yet. Run an update to set it up automatically.",
    "planAnalyticsReader": "Create a read-only Analytics Engine token and store it in the Worker",
    "note_AE_READER_PRESENT": "Already configured",
    "readerScopeMissingTitle": "API token permission not granted",
    "readerScopeMissingBody": "Cloudflare leaves \"API Tokens\" unticked on the consent page, so the read-only Analytics Engine token cannot be created for you. Re-authorize and tick it, or continue without it: InsightFlare still collects analytics, but request observation and other views that read Analytics Engine stay empty until you add a token under System Settings → Analytics Engine.",
    "reauthorize": "Re-authorize",
    "note_AE_READER_NOT_AUTHORIZED": "Skipped: the authorization does not include API token management",
    "upToDateAeOff": "This installation already runs the latest official build, but it was deployed without Analytics Engine. Run an update to switch it on.",
    "planEnableAnalytics": "Switch Analytics Engine on",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "bound, reader configured",
    "aeStatus_missing": "bound, reader not configured",
    "aeStatus_switched_off": "switched off when it was deployed",
    "aeStatus_not_bound": "not bound",
    "aeDisabledTitle": "Analytics Engine is not enabled on this account",
    "aeDisabledInstallBody": "If you install now, InsightFlare is deployed without Analytics Engine: analytics are collected, but request observation and related views stay empty until you enable it and run an update. To enable it, open Analytics Engine and click the blue \"Enable\" button in the top right, then check again here.",
    "aeDisabledUpdateBody": "Analytics Engine has to be enabled before an update can switch it on. Open Analytics Engine, click the blue \"Enable\" button in the top right, then check again here.",
    "recheck": "Check again",
    "blockersTitle": "This cannot continue yet",
    "blocker_WORKER_CONFLICT": "A Worker named insightflare already exists but is not an InsightFlare installation. Rename or remove it first.",
    "blocker_NIGHTLY_PENDING": "No official Nightly build is currently available. Try again in a few minutes.",
    "blocker_RELEASE_UNAVAILABLE": "The official build could not be downloaded or verified.",
    "blocker_DATABASE_TAKEN": "A D1 database named insightflare already contains data. Delete or rename it before installing.",
    "blocker_UPDATE_BLOCKED": "This installation cannot be updated automatically.",
    "adminPasswordTitle": "Administrator password",
    "adminPasswordGenerate": "Generate one for me (shown once when the installation finishes)",
    "adminPasswordCustom": "Set my own",
    "adminPasswordLabel": "Password",
    "adminPasswordRepeat": "Repeat password",
    "adminPasswordHint": "8 to 128 characters. Sign in as admin with it, and you can change it later.",
    "adminPasswordTooShort": "Use 8 to 128 characters.",
    "adminPasswordMismatch": "The two passwords do not match.",
    "adminCustomDesc": "Sign in as admin with the password you chose during setup.",
    "installButton": "Install InsightFlare",
    "updateButton": "Update InsightFlare",
    "confirmInstallTitle": "Install InsightFlare now?",
    "confirmInstallDesc": "The resources listed above will be created in {account}. This usually takes a few minutes.",
    "confirmUpdateTitle": "Update InsightFlare now?",
    "confirmUpdateDesc": "Database migrations cannot be undone automatically. InsightFlare keeps serving traffic during the update.",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "deployTitle": "Deploying",
    "deployDesc": "Keep this page open. If you close it, come back and the deployment continues where it stopped.",
    "runStep_verify": "Verify the official build and the account",
    "runStep_database": "Prepare the D1 database",
    "runStep_kv": "Prepare the KV namespace",
    "runStep_migrate": "Apply database migrations",
    "runStep_worker": "Upload the Worker",
    "runStep_schedules": "Set up scheduled tasks",
    "runStep_subdomain": "Enable the workers.dev address",
    "runStep_analytics": "Set up Analytics Engine reading",
    "runStep_health": "Check that InsightFlare responds",
    "runStep_stage": "Upload the new version (not live yet)",
    "runStep_activate": "Switch traffic to the new version",
    "statusPending": "Waiting",
    "statusRunning": "In progress",
    "statusDone": "Done",
    "statusSkipped": "Skipped",
    "statusWarning": "Needs attention",
    "statusFailed": "Failed",
    "note_CREATED": "Created {name}",
    "note_REUSED": "Using the existing one",
    "note_MIGRATIONS": "{applied} of {total} applied",
    "note_CRONS": "Scheduled tasks set: {count}",
    "note_URL": "Available at {url}",
    "note_AE_NOT_ENABLED": "Analytics Engine is not enabled on this account, so it was left out",
    "note_AE_ENABLED": "Analytics Engine is now enabled for this installation",
    "note_AE_READER_CONFIGURED": "Read-only token created and stored as a Worker secret",
    "note_AE_READER_MANUAL": "Could not create the token automatically; add it in InsightFlare's settings",
    "note_WORKERS_DEV_MISSING": "No workers.dev subdomain on this account",
    "note_NO_PUBLIC_URL": "No public address to check",
    "note_HEALTHY": "InsightFlare is responding",
    "note_WAITING": "Waiting for the address to come online ({attempt}/{total})",
    "note_HEALTH_TIMEOUT": "Not responding yet; a new address can take a few minutes",
    "note_ALREADY_CURRENT": "Already up to date",
    "note_ROLLED_BACK": "Health check failed; the previous version was restored",
    "runFailedTitle": "The deployment stopped",
    "runFailedDesc": "Everything finished so far is kept. Fix the problem if needed, then retry from this step.",
    "runSourceMovedDesc": "A newer official build has been published since this deployment started. Start over to deploy it; finished steps such as database migrations are not repeated.",
    "rolledBackDesc": "The new version did not pass its health check, so the previous version is serving traffic again. Database migrations that already ran are kept.",
    "retry": "Retry",
    "startOver": "Start over",
    "otherTab": "This deployment is being processed in another tab. This page will follow along.",
    "reconnectNeeded": "Your Cloudflare authorization expired. Connect again to continue; nothing is lost.",
    "doneInstallTitle": "InsightFlare is installed",
    "doneUpdateTitle": "InsightFlare is up to date",
    "doneDesc": "Running official build {sha}.",
    "openDashboard": "Open InsightFlare",
    "adminTitle": "Administrator sign-in",
    "adminDesc": "Shown only here. Save the password now and change it after your first sign-in.",
    "username": "Username",
    "password": "Password",
    "passwordSaved": "I have saved the password",
    "passwordForgotten": "The password is no longer shown. If it is lost, an administrator can reset it with the ops:admin:reset-password script in the InsightFlare repository.",
    "followUpTitle": "Things to finish",
    "followAeEnable": "Enable Analytics Engine (open it and click the blue \"Enable\" button in the top right), then run an update here to turn on request observation and the related analytics.",
    "followAeReader": "Add an API token with Account Analytics Read under System Settings → Analytics Engine in InsightFlare, or run an update here after re-authorizing with \"API Tokens\" ticked.",
    "followWorkersDev": "Add a custom domain to the insightflare Worker, or register a workers.dev subdomain, in the Cloudflare dashboard.",
    "followHealth": "The address did not respond yet. Give it a few minutes, then open it.",
    "openCloudflare": "Open Cloudflare dashboard",
    "finish": "Finish",
    "updateSafetyConfigure": "Only the changes listed above are applied; no new version is uploaded and InsightFlare keeps serving traffic.",
    "confirmUpdateNoMigrationDesc": "A new version is uploaded and switched on after it is verified; if it fails its health check, the previous version is restored. InsightFlare keeps serving traffic during the update.",
    "confirmConfigureTitle": "Apply these changes now?",
    "confirmConfigureDesc": "Only the changes listed above are applied, such as creating the read-only Analytics Engine token or attaching the domain. No new version is uploaded and no data is changed.",
    "configureButton": "Apply changes",
    "domainTitle": "Address",
    "domainCurrent": "Currently routed: {list}",
    "domainUseWorkersDev": "Use the workers.dev address",
    "domainKeep": "Keep the current address",
    "domainUseCustom": "Use one of my domains",
    "domainAddCustom": "Add another of my domains",
    "domainSubdomain": "Subdomain (empty for the domain itself)",
    "domainZone": "Domain",
    "domainZonePlaceholder": "Choose a domain",
    "domainHint": "Choose one of the domains in this Cloudflare account. Cloudflare creates the DNS record and certificate automatically.",
    "domainPreview": "InsightFlare will be served at https://{host}. Cloudflare creates the DNS record and certificate automatically; it refuses if the hostname already has a different record.",
    "domainAlready": "https://{host} already points to InsightFlare.",
    "domainInvalid": "The subdomain may only contain letters, digits, hyphens and dots.",
    "planDomain": "Route https://{host} to InsightFlare",
    "runStep_domain": "Attach the custom domain",
    "note_DOMAIN_ATTACHED": "Available at https://{host}",
    "note_DOMAIN_FAILED": "Could not attach {host}",
    "followDomain": "{host} could not be attached, usually because the hostname already has a DNS record. Remove or change that record, then run an update here, or add the domain to the insightflare Worker in the Cloudflare dashboard.",
    "domainNoZones": "This Cloudflare account has no active domain yet. Add a domain to the account, then come back here to route it to InsightFlare; until then the workers.dev address is used.",
    "domainZonesError": "The domains of this account could not be read ({error}). Re-authorize, or add the domain later; until then the workers.dev address is used.",
    "uninstallTitle": "Uninstall InsightFlare",
    "uninstallReviewDesc": "Review the exact resources to be removed.",
    "uninstallButton": "Uninstall",
    "uninstallCleanup": "Clean up failed installation",
    "uninstallConfirmTitle": "Permanently remove InsightFlare?",
    "uninstallWarning": "This permanently removes the listed Worker, D1 data and KV settings, including users and analytics. Durable Object state and Worker secrets may be lost. Back up anything you need first.",
    "uninstallResources": "Resources to remove",
    "uninstallResidual": "Analytics Engine history, API tokens and other unverified or external resources are not removed. Review those separately in Cloudflare.",
    "uninstallTypeName": "Type insightflare to confirm",
    "uninstallRunning": "Uninstalling",
    "uninstallDoneTitle": "InsightFlare is uninstalled",
    "uninstallDoneDesc": "The reviewed Worker and storage resources are no longer present.",
    "uninstallFailedDesc": "Uninstall stopped. Completed deletions are permanent; retry to continue from the failed step.",
    "runStep_removeWorker": "Remove the Worker and its associated resources",
    "runStep_removeDatabase": "Delete the reviewed D1 database",
    "runStep_removeKv": "Delete the reviewed KV namespace",
    "runStep_verifyRemoval": "Verify resource removal",
    "runStep_removeDomains": "Detach remaining reviewed custom domains"
  }
};
const zhMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "你的分析数据，留在你自己的 Cloudflare 账号里。",
    "wizard": "部署向导",
    "wizardHelp": "一键把 InsightFlare 安装或更新到你自己的 Cloudflare 账号。所有操作都使用你的授权执行，中途中断也可以继续。",
    "language": "语言",
    "theme": "主题",
    "lightTheme": "浅色",
    "darkTheme": "深色",
    "systemTheme": "跟随系统",
    "connected": "已连接",
    "disconnected": "未连接",
    "stepCount": "第 {current} 步，共 {total} 步",
    "progress": "进度",
    "back": "上一步",
    "next": "继续",
    "dismiss": "关闭",
    "loading": "加载中…",
    "refresh": "刷新",
    "copy": "复制",
    "copied": "已复制",
    "details": "详细信息",
    "unexpectedError": "出了点问题，请重试。",
    "httpError": "请求失败（HTTP {status}）。",
    "stepConnect": "连接",
    "stepAccount": "账号",
    "stepReview": "确认方案",
    "stepDeploy": "执行",
    "stepDone": "完成",
    "connectTitle": "连接你的 Cloudflare 账号",
    "connectDesc": "使用 Cloudflare 登录，并同意 InsightFlare 安装到你账号所需的权限。",
    "connectButton": "使用 Cloudflare 连接",
    "oauthMissing": "本服务尚未配置 Cloudflare 登录。",
    "connectedDesc": "你的 Cloudflare 授权有效至 {time}。",
    "disconnect": "断开连接",
    "dataPromise": "你的分析数据始终留在你自己的 Cloudflare 账号中。",
    "permissionsTitle": "这次授权可以做什么",
    "permissionsBody": "创建和更新名为 insightflare 的 Worker 及其 D1 数据库、KV 命名空间，并创建一个只能读取 Analytics Engine 的 token。Cloudflare 授权页默认不勾选“API 令牌”，请手动勾选，这样才能自动创建这个 token。授权一小时内过期，且不会以明文保存。",
    "authFailed": "Cloudflare 登录未完成（{error}），请重试。",
    "accountTitle": "选择账号",
    "accountDesc": "我们会在你选择的账号中查找已有的 InsightFlare。",
    "accountLabel": "Cloudflare 账号",
    "accountPlaceholder": "选择一个账号",
    "discovering": "正在检查账号…",
    "kindNotInstalled": "尚未安装",
    "kindManaged": "已安装",
    "kindLegacy": "已安装（早于本工具部署）",
    "kindConflict": "名称冲突",
    "deployedCommit": "当前运行版本 {sha}",
    "resumeRun": "这个账号有一次部署正在进行或需要你处理，继续即可查看。",
    "reviewTitle": "确认部署方案",
    "reviewDesc": "确认之前不会做任何改动。方案固定使用下面这个官方构建。",
    "sourceCommit": "官方构建",
    "viewCommit": "查看提交",
    "installPlanTitle": "将会创建",
    "planWorker": "Worker {name}，以及它的 Durable Object 和静态资源",
    "planDatabaseCreate": "D1 数据库 {name}",
    "planDatabaseReuse": "使用已有的空 D1 数据库 {name}",
    "planKvCreate": "KV 命名空间 {name}",
    "planKvReuse": "使用已有的 KV 命名空间 {name}",
    "planMigrations": "{count} 个数据库迁移",
    "planCrons": "定时任务 {list}",
    "planUrl": "访问地址 {url}",
    "planNoWorkersDev": "这个账号还没有 workers.dev 子域名。InsightFlare 仍会安装，但之后需要绑定域名或注册 workers.dev。",
    "planSecrets": "随机生成的根密钥",
    "planAnalytics": "Analytics Engine 数据集",
    "planAnalyticsNote": "这个账号已开启 Analytics Engine，会绑定数据集，并为 InsightFlare 创建只读 token。",
    "enableAnalyticsEngine": "打开 Analytics Engine",
    "updatePlanTitle": "将会更新",
    "updateFromTo": "从 {from} 更新到 {to}",
    "unknownVersion": "未记录的版本",
    "updatePendingMigrations": "需要执行 {count} 个数据库迁移",
    "updateNoMigrations": "无需数据库迁移",
    "updateDestructive": "部分迁移会修改或删除现有表，请确认有近期备份。",
    "updateDoMigration": "包含 Durable Object 迁移",
    "updateSafety": "新版本会先上传，数据库就绪后才切换。如果健康检查失败，会自动恢复到之前的版本。",
    "legacyAdopt": "这个实例早于 InsightFlare Deploy 部署。我同意之后由 Deploy 管理它；数据、secret 和绑定都会保留。",
    "upToDate": "这个实例已经是最新的官方构建。如有需要，仍可以在下方绑定自定义域名。",
    "upToDateReaderMissing": "这个实例已经是最新的官方构建，但还没有配置 Analytics Engine 读取。执行一次更新即可自动配置。",
    "planAnalyticsReader": "创建 Analytics Engine 只读 token 并写入 Worker",
    "note_AE_READER_PRESENT": "已配置过",
    "readerScopeMissingTitle": "未授予 API 令牌管理权限",
    "readerScopeMissingBody": "Cloudflare 授权页默认不勾选“API 令牌”，所以无法自动创建 Analytics Engine 只读 token。你可以重新授权并勾选它，也可以直接继续：InsightFlare 照常采集数据，但请求观测等需要读取 Analytics Engine 的页面会没有数据，直到你在“系统设置 → 分析引擎”中手动填写 token。",
    "reauthorize": "重新授权",
    "note_AE_READER_NOT_AUTHORIZED": "已跳过：本次授权不包含 API 令牌管理权限",
    "upToDateAeOff": "这个实例已经是最新的官方构建，但部署时没有开启 Analytics Engine。执行一次更新即可为它开启。",
    "planEnableAnalytics": "开启 Analytics Engine",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "已绑定，读取已配置",
    "aeStatus_missing": "已绑定，读取未配置",
    "aeStatus_switched_off": "部署时未开启",
    "aeStatus_not_bound": "未绑定",
    "aeDisabledTitle": "这个账号尚未开启 Analytics Engine",
    "aeDisabledInstallBody": "现在安装的话，InsightFlare 会先不带 Analytics Engine 部署：照常采集数据，但请求观测等相关页面会没有数据，直到开启后再执行一次更新。开启方法：打开 Analytics Engine 页面，点击右上角蓝色的 “Enable” 按钮，然后回到这里重新检测。",
    "aeDisabledUpdateBody": "需要先开启 Analytics Engine，更新才能为这个实例开启它。请打开 Analytics Engine 页面，点击右上角蓝色的 “Enable” 按钮，然后回到这里重新检测。",
    "recheck": "重新检测",
    "blockersTitle": "暂时无法继续",
    "blocker_WORKER_CONFLICT": "已经有一个名为 insightflare 的 Worker，但它不是 InsightFlare。请先重命名或删除它。",
    "blocker_NIGHTLY_PENDING": "目前没有可用的官方 Nightly 构建，请稍后重试。",
    "blocker_RELEASE_UNAVAILABLE": "无法下载或校验官方构建。",
    "blocker_DATABASE_TAKEN": "已经有一个名为 insightflare 且包含数据的 D1 数据库。请先删除或重命名它再安装。",
    "blocker_UPDATE_BLOCKED": "这个实例无法自动更新。",
    "adminPasswordTitle": "管理员密码",
    "adminPasswordGenerate": "自动生成（安装完成时显示一次）",
    "adminPasswordCustom": "自己设置",
    "adminPasswordLabel": "密码",
    "adminPasswordRepeat": "再次输入密码",
    "adminPasswordHint": "8 到 128 个字符。用它以 admin 登录，之后可以修改。",
    "adminPasswordTooShort": "请输入 8 到 128 个字符。",
    "adminPasswordMismatch": "两次输入的密码不一致。",
    "adminCustomDesc": "使用你在安装时设置的密码，以 admin 身份登录。",
    "installButton": "安装 InsightFlare",
    "updateButton": "更新 InsightFlare",
    "confirmInstallTitle": "现在安装 InsightFlare？",
    "confirmInstallDesc": "将在 {account} 中创建上面列出的资源，通常需要几分钟。",
    "confirmUpdateTitle": "现在更新 InsightFlare？",
    "confirmUpdateDesc": "数据库迁移无法自动撤销。更新期间 InsightFlare 会继续正常提供服务。",
    "confirm": "确认",
    "cancel": "取消",
    "deployTitle": "正在部署",
    "deployDesc": "请保持页面打开。如果关闭了，回来后会从中断的地方继续。",
    "runStep_verify": "校验官方构建和账号",
    "runStep_database": "准备 D1 数据库",
    "runStep_kv": "准备 KV 命名空间",
    "runStep_migrate": "执行数据库迁移",
    "runStep_worker": "上传 Worker",
    "runStep_schedules": "设置定时任务",
    "runStep_subdomain": "开启 workers.dev 地址",
    "runStep_analytics": "配置 Analytics Engine 读取",
    "runStep_health": "检查 InsightFlare 是否正常响应",
    "runStep_stage": "上传新版本（尚未生效）",
    "runStep_activate": "将流量切换到新版本",
    "statusPending": "等待中",
    "statusRunning": "进行中",
    "statusDone": "完成",
    "statusSkipped": "已跳过",
    "statusWarning": "需要留意",
    "statusFailed": "失败",
    "note_CREATED": "已创建 {name}",
    "note_REUSED": "使用已有的资源",
    "note_MIGRATIONS": "已执行 {applied} / {total}",
    "note_CRONS": "已设置 {count} 个定时任务",
    "note_URL": "地址：{url}",
    "note_AE_NOT_ENABLED": "账号尚未开启 Analytics Engine，已先跳过",
    "note_AE_ENABLED": "已为这个实例启用 Analytics Engine",
    "note_AE_READER_CONFIGURED": "已创建只读 token 并保存为 Worker secret",
    "note_AE_READER_MANUAL": "无法自动创建 token，请在 InsightFlare 设置中手动填写",
    "note_WORKERS_DEV_MISSING": "账号没有 workers.dev 子域名",
    "note_NO_PUBLIC_URL": "没有可检查的公开地址",
    "note_HEALTHY": "InsightFlare 响应正常",
    "note_WAITING": "等待地址生效（{attempt}/{total}）",
    "note_HEALTH_TIMEOUT": "暂时还没有响应，新地址可能需要几分钟才生效",
    "note_ALREADY_CURRENT": "已经是最新",
    "note_ROLLED_BACK": "健康检查失败，已恢复到之前的版本",
    "runFailedTitle": "部署已停止",
    "runFailedDesc": "已完成的部分都会保留。必要时先处理问题，然后从这一步重试。",
    "runSourceMovedDesc": "这次部署开始后，官方发布了更新的构建。请重新开始以部署新版本，已完成的步骤（例如数据库迁移）不会重复执行。",
    "rolledBackDesc": "新版本未通过健康检查，之前的版本已重新接管流量。已经执行的数据库迁移会保留。",
    "retry": "重试",
    "startOver": "重新开始",
    "otherTab": "这次部署正在另一个标签页中执行，本页面会同步显示进度。",
    "reconnectNeeded": "Cloudflare 授权已过期。重新连接即可继续，进度不会丢失。",
    "doneInstallTitle": "InsightFlare 已安装",
    "doneUpdateTitle": "InsightFlare 已更新",
    "doneDesc": "当前运行官方构建 {sha}。",
    "openDashboard": "打开 InsightFlare",
    "adminTitle": "管理员登录信息",
    "adminDesc": "只会在这里显示一次。请现在保存密码，并在首次登录后修改。",
    "username": "用户名",
    "password": "密码",
    "passwordSaved": "我已保存密码",
    "passwordForgotten": "密码已不再显示。如果遗失，可以在 InsightFlare 仓库中运行 ops:admin:reset-password 脚本重置。",
    "followUpTitle": "还需要处理",
    "followAeEnable": "开启 Analytics Engine（打开页面后点击右上角蓝色的 “Enable” 按钮），然后回到这里执行一次更新，即可启用请求观测等相关分析。",
    "followAeReader": "在 InsightFlare 的“系统设置 → 分析引擎”中填写一个带 Account Analytics Read 权限的 API Token；或者重新授权并勾选“API 令牌”后，回到这里执行一次更新。",
    "followWorkersDev": "在 Cloudflare 控制台为 insightflare Worker 绑定自定义域名，或注册 workers.dev 子域名。",
    "followHealth": "地址暂时还没有响应，请过几分钟再打开。",
    "openCloudflare": "打开 Cloudflare 控制台",
    "finish": "完成",
    "updateSafetyConfigure": "只会执行上面列出的配置，不会上传新版本，InsightFlare 持续正常提供服务。",
    "confirmUpdateNoMigrationDesc": "会上传新版本并在校验通过后切换；如果健康检查失败，会恢复到之前的版本。更新期间 InsightFlare 会继续正常提供服务。",
    "confirmConfigureTitle": "现在应用这些配置？",
    "confirmConfigureDesc": "只会执行上面列出的配置，例如创建 Analytics Engine 只读 token、绑定域名。不会上传新版本，也不会改动数据。",
    "configureButton": "应用配置",
    "domainTitle": "访问域名",
    "domainCurrent": "当前已绑定：{list}",
    "domainUseWorkersDev": "使用 workers.dev 地址",
    "domainKeep": "保持现有地址",
    "domainUseCustom": "使用我自己的域名",
    "domainAddCustom": "再绑定一个我自己的域名",
    "domainSubdomain": "子域名（留空表示直接使用主域名）",
    "domainZone": "域名",
    "domainZonePlaceholder": "选择一个域名",
    "domainHint": "从这个 Cloudflare 账号的域名中选择一个。Cloudflare 会自动创建 DNS 记录和证书。",
    "domainPreview": "InsightFlare 将通过 https://{host} 访问。Cloudflare 会自动创建 DNS 记录和证书；如果这个地址已有其他记录，会拒绝绑定。",
    "domainAlready": "https://{host} 已经绑定到 InsightFlare。",
    "domainInvalid": "子域名只能包含字母、数字、连字符和点。",
    "planDomain": "将 https://{host} 绑定到 InsightFlare",
    "runStep_domain": "绑定自定义域名",
    "note_DOMAIN_ATTACHED": "已绑定 https://{host}",
    "note_DOMAIN_FAILED": "无法绑定 {host}",
    "followDomain": "无法绑定 {host}，通常是因为这个地址已有 DNS 记录。删除或修改那条记录后，回到这里执行一次更新；也可以在 Cloudflare 控制台为 insightflare Worker 添加该域名。",
    "domainNoZones": "这个 Cloudflare 账号里还没有已激活的域名。把域名添加到这个账号后，回到这里即可绑定到 InsightFlare；在此之前会使用 workers.dev 地址。",
    "domainZonesError": "无法读取这个账号的域名（{error}）。可以重新授权，或者之后再绑定；在此之前会使用 workers.dev 地址。",
    "uninstallTitle": "卸载 InsightFlare",
    "uninstallReviewDesc": "检查即将删除的资源。",
    "uninstallButton": "卸载",
    "uninstallCleanup": "清理失败的安装",
    "uninstallConfirmTitle": "永久卸载 InsightFlare？",
    "uninstallWarning": "此操作将永久移除列出的 Worker、D1 数据及 KV 设置，包括用户和分析数据。Durable Objects 状态与 Worker 密钥可能丢失。请先备份需要的数据。",
    "uninstallResources": "待删除资源",
    "uninstallResidual": "Analytics Engine 历史数据、API Token 以及其他无法确认归属或外部资源将保留，请在 Cloudflare 中单独检查。",
    "uninstallTypeName": "输入 insightflare 以确认",
    "uninstallRunning": "正在卸载",
    "uninstallDoneTitle": "InsightFlare 已卸载",
    "uninstallDoneDesc": "已确认审核清单中的 Worker 和存储资源不再存在。",
    "uninstallFailedDesc": "卸载已停止。已完成的删除不可撤销；重试可从失败步骤继续。",
    "runStep_removeWorker": "移除 Worker 及其关联资源",
    "runStep_removeDatabase": "删除已审核的 D1 数据库",
    "runStep_removeKv": "删除已审核的 KV 命名空间",
    "runStep_verifyRemoval": "验证资源已移除",
    "runStep_removeDomains": "解除仍存在的已审核自定义域名绑定"
  }
};
const zh_twMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "你的分析資料，留在你自己的 Cloudflare 帳號裡。",
    "wizard": "部署精靈",
    "wizardHelp": "一鍵把 InsightFlare 安裝或更新到你自己的 Cloudflare 帳號。所有操作都使用你的授權執行，中途中斷也可以繼續。",
    "language": "語言",
    "theme": "主題",
    "lightTheme": "淺色",
    "darkTheme": "深色",
    "systemTheme": "跟隨系統",
    "connected": "已連線",
    "disconnected": "未連線",
    "stepCount": "第 {current} 步，共 {total} 步",
    "progress": "進度",
    "back": "上一步",
    "next": "繼續",
    "dismiss": "關閉",
    "loading": "載入中…",
    "refresh": "重新整理",
    "copy": "複製",
    "copied": "已複製",
    "details": "詳細資訊",
    "unexpectedError": "出了點問題，請重試。",
    "httpError": "請求失敗（HTTP {status}）。",
    "stepConnect": "連線",
    "stepAccount": "帳號",
    "stepReview": "確認方案",
    "stepDeploy": "執行",
    "stepDone": "完成",
    "connectTitle": "連線你的 Cloudflare 帳號",
    "connectDesc": "使用 Cloudflare 登入，並同意 InsightFlare 安裝到你帳號所需的權限。",
    "connectButton": "使用 Cloudflare 連線",
    "oauthMissing": "本服務尚未設定 Cloudflare 登入。",
    "connectedDesc": "你的 Cloudflare 授權有效至 {time}。",
    "disconnect": "中斷連線",
    "dataPromise": "你的分析資料始終留在你自己的 Cloudflare 帳號中。",
    "permissionsTitle": "這次授權可以做什麼",
    "permissionsBody": "建立和更新名為 insightflare 的 Worker 及其 D1 資料庫、KV 命名空間，並建立一個只能讀取 Analytics Engine 的 token。Cloudflare 授權頁預設不勾選「API 權杖」，請手動勾選，這樣才能自動建立這個 token。授權一小時內過期，且不會以明文保存。",
    "authFailed": "Cloudflare 登入未完成（{error}），請重試。",
    "accountTitle": "選擇帳號",
    "accountDesc": "我們會在你選擇的帳號中尋找已有的 InsightFlare。",
    "accountLabel": "Cloudflare 帳號",
    "accountPlaceholder": "選擇一個帳號",
    "discovering": "正在檢查帳號…",
    "kindNotInstalled": "尚未安裝",
    "kindManaged": "已安裝",
    "kindLegacy": "已安裝（早於本工具部署）",
    "kindConflict": "名稱衝突",
    "deployedCommit": "目前執行版本 {sha}",
    "resumeRun": "這個帳號有一次部署正在進行或需要你處理，繼續即可查看。",
    "reviewTitle": "確認部署方案",
    "reviewDesc": "確認之前不會做任何變更。方案固定使用下面這個官方建置。",
    "sourceCommit": "官方建置",
    "viewCommit": "檢視提交",
    "installPlanTitle": "將會建立",
    "planWorker": "Worker {name}，以及它的 Durable Object 和靜態資源",
    "planDatabaseCreate": "D1 資料庫 {name}",
    "planDatabaseReuse": "使用已有的空 D1 資料庫 {name}",
    "planKvCreate": "KV 命名空間 {name}",
    "planKvReuse": "使用已有的 KV 命名空間 {name}",
    "planMigrations": "{count} 個資料庫遷移",
    "planCrons": "排程任務 {list}",
    "planUrl": "存取網址 {url}",
    "planNoWorkersDev": "這個帳號還沒有 workers.dev 子網域。InsightFlare 仍會安裝，但之後需要綁定網域或註冊 workers.dev。",
    "planSecrets": "隨機產生的根密鑰",
    "planAnalytics": "Analytics Engine 資料集",
    "planAnalyticsNote": "這個帳號已開啟 Analytics Engine，會綁定資料集，並為 InsightFlare 建立唯讀 token。",
    "enableAnalyticsEngine": "開啟 Analytics Engine",
    "updatePlanTitle": "將會更新",
    "updateFromTo": "從 {from} 更新到 {to}",
    "unknownVersion": "未記錄的版本",
    "updatePendingMigrations": "需要執行 {count} 個資料庫遷移",
    "updateNoMigrations": "無需資料庫遷移",
    "updateDestructive": "部分遷移會修改或刪除現有資料表，請確認有近期備份。",
    "updateDoMigration": "包含 Durable Object 遷移",
    "updateSafety": "新版本會先上傳，資料庫就緒後才切換。如果健康檢查失敗，會自動恢復到之前的版本。",
    "legacyAdopt": "這個實例早於 InsightFlare Deploy 部署。我同意之後由 Deploy 管理它；資料、secret 和綁定都會保留。",
    "upToDate": "這個實例已經是最新的官方建置。如有需要，仍可以在下方綁定自訂網域。",
    "upToDateReaderMissing": "這個實例已經是最新的官方建置，但還沒有設定 Analytics Engine 讀取。執行一次更新即可自動設定。",
    "planAnalyticsReader": "建立 Analytics Engine 唯讀 token 並寫入 Worker",
    "note_AE_READER_PRESENT": "已設定過",
    "readerScopeMissingTitle": "未授予 API 權杖管理權限",
    "readerScopeMissingBody": "Cloudflare 授權頁預設不勾選「API 權杖」，所以無法自動建立 Analytics Engine 唯讀 token。你可以重新授權並勾選它，也可以直接繼續：InsightFlare 照常收集資料，但請求觀測等需要讀取 Analytics Engine 的頁面會沒有資料，直到你在「系統設定 → 分析引擎」中手動填寫 token。",
    "reauthorize": "重新授權",
    "note_AE_READER_NOT_AUTHORIZED": "已略過：本次授權不包含 API 權杖管理權限",
    "upToDateAeOff": "這個實例已經是最新的官方建置，但部署時沒有開啟 Analytics Engine。執行一次更新即可為它開啟。",
    "planEnableAnalytics": "開啟 Analytics Engine",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "已綁定，讀取已設定",
    "aeStatus_missing": "已綁定，讀取未設定",
    "aeStatus_switched_off": "部署時未開啟",
    "aeStatus_not_bound": "未綁定",
    "aeDisabledTitle": "這個帳號尚未開啟 Analytics Engine",
    "aeDisabledInstallBody": "現在安裝的話，InsightFlare 會先不帶 Analytics Engine 部署：照常收集資料，但請求觀測等相關頁面會沒有資料，直到開啟後再執行一次更新。開啟方法：打開 Analytics Engine 頁面，點擊右上角藍色的 “Enable” 按鈕，然後回到這裡重新檢測。",
    "aeDisabledUpdateBody": "需要先開啟 Analytics Engine，更新才能為這個實例開啟它。請打開 Analytics Engine 頁面，點擊右上角藍色的 “Enable” 按鈕，然後回到這裡重新檢測。",
    "recheck": "重新檢測",
    "blockersTitle": "暫時無法繼續",
    "blocker_WORKER_CONFLICT": "已經有一個名為 insightflare 的 Worker，但它不是 InsightFlare。請先重新命名或刪除它。",
    "blocker_NIGHTLY_PENDING": "目前沒有可用的官方 Nightly 建置，請稍後再試。",
    "blocker_RELEASE_UNAVAILABLE": "無法下載或驗證官方建置。",
    "blocker_DATABASE_TAKEN": "已經有一個名為 insightflare 且包含資料的 D1 資料庫。請先刪除或重新命名它再安裝。",
    "blocker_UPDATE_BLOCKED": "這個實例無法自動更新。",
    "adminPasswordTitle": "管理員密碼",
    "adminPasswordGenerate": "自動產生（安裝完成時顯示一次）",
    "adminPasswordCustom": "自己設定",
    "adminPasswordLabel": "密碼",
    "adminPasswordRepeat": "再次輸入密碼",
    "adminPasswordHint": "8 到 128 個字元。用它以 admin 登入，之後可以修改。",
    "adminPasswordTooShort": "請輸入 8 到 128 個字元。",
    "adminPasswordMismatch": "兩次輸入的密碼不一致。",
    "adminCustomDesc": "使用你在安裝時設定的密碼，以 admin 身分登入。",
    "installButton": "安裝 InsightFlare",
    "updateButton": "更新 InsightFlare",
    "confirmInstallTitle": "現在安裝 InsightFlare？",
    "confirmInstallDesc": "將在 {account} 中建立上面列出的資源，通常需要幾分鐘。",
    "confirmUpdateTitle": "現在更新 InsightFlare？",
    "confirmUpdateDesc": "資料庫遷移無法自動復原。更新期間 InsightFlare 會繼續正常提供服務。",
    "confirm": "確認",
    "cancel": "取消",
    "deployTitle": "正在部署",
    "deployDesc": "請保持頁面開啟。如果關閉了，回來後會從中斷的地方繼續。",
    "runStep_verify": "驗證官方建置和帳號",
    "runStep_database": "準備 D1 資料庫",
    "runStep_kv": "準備 KV 命名空間",
    "runStep_migrate": "執行資料庫遷移",
    "runStep_worker": "上傳 Worker",
    "runStep_schedules": "設定排程任務",
    "runStep_subdomain": "開啟 workers.dev 網址",
    "runStep_analytics": "設定 Analytics Engine 讀取",
    "runStep_health": "檢查 InsightFlare 是否正常回應",
    "runStep_stage": "上傳新版本（尚未生效）",
    "runStep_activate": "將流量切換到新版本",
    "statusPending": "等待中",
    "statusRunning": "進行中",
    "statusDone": "完成",
    "statusSkipped": "已略過",
    "statusWarning": "需要留意",
    "statusFailed": "失敗",
    "note_CREATED": "已建立 {name}",
    "note_REUSED": "使用已有的資源",
    "note_MIGRATIONS": "已執行 {applied} / {total}",
    "note_CRONS": "已設定 {count} 個排程任務",
    "note_URL": "網址：{url}",
    "note_AE_NOT_ENABLED": "帳號尚未開啟 Analytics Engine，已先略過",
    "note_AE_ENABLED": "已為這個實例啟用 Analytics Engine",
    "note_AE_READER_CONFIGURED": "已建立唯讀 token 並保存為 Worker secret",
    "note_AE_READER_MANUAL": "無法自動建立 token，請在 InsightFlare 設定中手動填寫",
    "note_WORKERS_DEV_MISSING": "帳號沒有 workers.dev 子網域",
    "note_NO_PUBLIC_URL": "沒有可檢查的公開網址",
    "note_HEALTHY": "InsightFlare 回應正常",
    "note_WAITING": "等待網址生效（{attempt}/{total}）",
    "note_HEALTH_TIMEOUT": "暫時還沒有回應，新網址可能需要幾分鐘才生效",
    "note_ALREADY_CURRENT": "已經是最新",
    "note_ROLLED_BACK": "健康檢查失敗，已恢復到之前的版本",
    "runFailedTitle": "部署已停止",
    "runFailedDesc": "已完成的部分都會保留。必要時先處理問題，然後從這一步重試。",
    "runSourceMovedDesc": "這次部署開始後，官方發布了更新的建置。請重新開始以部署新版本，已完成的步驟（例如資料庫遷移）不會重複執行。",
    "rolledBackDesc": "新版本未通過健康檢查，之前的版本已重新接管流量。已經執行的資料庫遷移會保留。",
    "retry": "重試",
    "startOver": "重新開始",
    "otherTab": "這次部署正在另一個分頁中執行，本頁面會同步顯示進度。",
    "reconnectNeeded": "Cloudflare 授權已過期。重新連線即可繼續，進度不會遺失。",
    "doneInstallTitle": "InsightFlare 已安裝",
    "doneUpdateTitle": "InsightFlare 已更新",
    "doneDesc": "目前執行官方建置 {sha}。",
    "openDashboard": "開啟 InsightFlare",
    "adminTitle": "管理員登入資訊",
    "adminDesc": "只會在這裡顯示一次。請現在保存密碼，並在首次登入後修改。",
    "username": "使用者名稱",
    "password": "密碼",
    "passwordSaved": "我已保存密碼",
    "passwordForgotten": "密碼已不再顯示。如果遺失，可以在 InsightFlare 儲存庫中執行 ops:admin:reset-password 腳本重設。",
    "followUpTitle": "還需要處理",
    "followAeEnable": "開啟 Analytics Engine（打開頁面後點擊右上角藍色的 “Enable” 按鈕），然後回到這裡執行一次更新，即可啟用請求觀測等相關分析。",
    "followAeReader": "在 InsightFlare 的「系統設定 → 分析引擎」中填寫一個帶 Account Analytics Read 權限的 API Token；或者重新授權並勾選「API 權杖」後，回到這裡執行一次更新。",
    "followWorkersDev": "在 Cloudflare 控制台為 insightflare Worker 綁定自訂網域，或註冊 workers.dev 子網域。",
    "followHealth": "網址暫時還沒有回應，請過幾分鐘再開啟。",
    "openCloudflare": "開啟 Cloudflare 控制台",
    "finish": "完成",
    "updateSafetyConfigure": "只會執行上面列出的設定，不會上傳新版本，InsightFlare 持續正常提供服務。",
    "confirmUpdateNoMigrationDesc": "會上傳新版本並在校驗通過後切換；如果健康檢查失敗，會恢復到之前的版本。更新期間 InsightFlare 會繼續正常提供服務。",
    "confirmConfigureTitle": "現在套用這些設定？",
    "confirmConfigureDesc": "只會執行上面列出的設定，例如建立 Analytics Engine 唯讀 token、綁定網域。不會上傳新版本，也不會改動資料。",
    "configureButton": "套用設定",
    "domainTitle": "存取網域",
    "domainCurrent": "目前已綁定：{list}",
    "domainUseWorkersDev": "使用 workers.dev 網址",
    "domainKeep": "保持現有網址",
    "domainUseCustom": "使用我自己的網域",
    "domainAddCustom": "再綁定一個我自己的網域",
    "domainSubdomain": "子網域（留空表示直接使用主網域）",
    "domainZone": "網域",
    "domainZonePlaceholder": "選擇一個網域",
    "domainHint": "從這個 Cloudflare 帳號的網域中選擇一個。Cloudflare 會自動建立 DNS 記錄和憑證。",
    "domainPreview": "InsightFlare 將透過 https://{host} 存取。Cloudflare 會自動建立 DNS 記錄和憑證；如果這個網址已有其他記錄，會拒絕綁定。",
    "domainAlready": "https://{host} 已經綁定到 InsightFlare。",
    "domainInvalid": "子網域只能包含字母、數字、連字號和點。",
    "planDomain": "將 https://{host} 綁定到 InsightFlare",
    "runStep_domain": "綁定自訂網域",
    "note_DOMAIN_ATTACHED": "已綁定 https://{host}",
    "note_DOMAIN_FAILED": "無法綁定 {host}",
    "followDomain": "無法綁定 {host}，通常是因為這個網址已有 DNS 記錄。刪除或修改那條記錄後，回到這裡執行一次更新；也可以在 Cloudflare 控制台為 insightflare Worker 新增該網域。",
    "domainNoZones": "這個 Cloudflare 帳號裡還沒有已啟用的網域。把網域新增到這個帳號後，回到這裡即可綁定到 InsightFlare；在此之前會使用 workers.dev 網址。",
    "domainZonesError": "無法讀取這個帳號的網域（{error}）。可以重新授權，或者之後再綁定；在此之前會使用 workers.dev 網址。",
    "uninstallTitle": "解除安裝 InsightFlare",
    "uninstallReviewDesc": "檢查即將刪除的資源。",
    "uninstallButton": "解除安裝",
    "uninstallCleanup": "清理失敗的安裝",
    "uninstallConfirmTitle": "永久解除安裝 InsightFlare？",
    "uninstallWarning": "此操作將永久移除列出的 Worker、D1 資料及 KV 設定，包括使用者和分析資料。Durable Objects 狀態與 Worker 密鑰可能遺失。請先備份所需資料。",
    "uninstallResources": "待刪除資源",
    "uninstallResidual": "Analytics Engine 歷史資料、API Token 及其他無法確認歸屬或外部資源將保留，請在 Cloudflare 中另行檢查。",
    "uninstallTypeName": "輸入 insightflare 以確認",
    "uninstallRunning": "正在解除安裝",
    "uninstallDoneTitle": "InsightFlare 已解除安裝",
    "uninstallDoneDesc": "已確認審核清單中的 Worker 和儲存資源不再存在。",
    "uninstallFailedDesc": "解除安裝已停止。已完成的刪除無法復原；重試可從失敗步驟繼續。",
    "runStep_removeWorker": "移除 Worker 及其關聯資源",
    "runStep_removeDatabase": "刪除已審核的 D1 資料庫",
    "runStep_removeKv": "刪除已審核的 KV 命名空間",
    "runStep_verifyRemoval": "驗證資源已移除",
    "runStep_removeDomains": "解除仍存在的已審核自訂網域綁定"
  }
};
const jaMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "分析データは、あなた自身の Cloudflare アカウントに。",
    "wizard": "デプロイアシスタント",
    "wizardHelp": "InsightFlare をワンクリックで自分の Cloudflare アカウントにインストール／更新します。すべてあなたの認可で実行され、中断しても再開できます。",
    "language": "言語",
    "theme": "テーマ",
    "lightTheme": "ライト",
    "darkTheme": "ダーク",
    "systemTheme": "システム",
    "connected": "接続済み",
    "disconnected": "未接続",
    "stepCount": "ステップ {current} / {total}",
    "progress": "進捗",
    "back": "戻る",
    "next": "次へ",
    "dismiss": "閉じる",
    "loading": "読み込み中…",
    "refresh": "再読み込み",
    "copy": "コピー",
    "copied": "コピーしました",
    "details": "詳細",
    "unexpectedError": "問題が発生しました。もう一度お試しください。",
    "httpError": "リクエストに失敗しました（HTTP {status}）。",
    "stepConnect": "接続",
    "stepAccount": "アカウント",
    "stepReview": "確認",
    "stepDeploy": "実行",
    "stepDone": "完了",
    "connectTitle": "Cloudflare アカウントを接続",
    "connectDesc": "Cloudflare でサインインし、InsightFlare をアカウントにインストールするための権限を承認してください。",
    "connectButton": "Cloudflare で接続",
    "oauthMissing": "このサービスでは Cloudflare サインインがまだ設定されていません。",
    "connectedDesc": "Cloudflare の認可は {time} まで有効です。",
    "disconnect": "切断",
    "dataPromise": "分析データがあなたの Cloudflare アカウントの外に出ることはありません。",
    "permissionsTitle": "この認可でできること",
    "permissionsBody": "insightflare Worker とその D1 データベース・KV 名前空間の作成と更新、および Analytics Engine 読み取り専用トークンの作成を行います。Cloudflare の同意画面では「API トークン」がデフォルトで未選択なので、トークンを自動作成できるよう手動でチェックを入れてください。認可は 1 時間以内に失効し、平文で保存されることはありません。",
    "authFailed": "Cloudflare サインインが完了しませんでした（{error}）。もう一度お試しください。",
    "accountTitle": "アカウントを選択",
    "accountDesc": "選択したアカウントで既存の InsightFlare を探します。",
    "accountLabel": "Cloudflare アカウント",
    "accountPlaceholder": "アカウントを選択",
    "discovering": "アカウントを確認中…",
    "kindNotInstalled": "未インストール",
    "kindManaged": "インストール済み",
    "kindLegacy": "インストール済み（本ツール以前に構築）",
    "kindConflict": "名前の競合",
    "deployedCommit": "実行中のコミット {sha}",
    "resumeRun": "このアカウントには進行中または対応が必要なデプロイがあります。次へ進んで確認してください。",
    "reviewTitle": "プランを確認",
    "reviewDesc": "確認するまで何も変更されません。プランは下記の公式ビルドに固定されます。",
    "sourceCommit": "公式ビルド",
    "viewCommit": "コミットを見る",
    "installPlanTitle": "作成するもの",
    "planWorker": "Worker {name}（Durable Object と静的アセットを含む）",
    "planDatabaseCreate": "D1 データベース {name}",
    "planDatabaseReuse": "既存の空の D1 データベース {name} を使用",
    "planKvCreate": "KV 名前空間 {name}",
    "planKvReuse": "既存の KV 名前空間 {name} を使用",
    "planMigrations": "データベースマイグレーション {count} 件",
    "planCrons": "スケジュールタスク {list}",
    "planUrl": "公開アドレス {url}",
    "planNoWorkersDev": "このアカウントにはまだ workers.dev サブドメインがありません。インストールは行われますが、後でドメインを追加するか workers.dev を登録する必要があります。",
    "planSecrets": "ランダムに生成されるルートシークレット",
    "planAnalytics": "Analytics Engine データセット",
    "planAnalyticsNote": "このアカウントでは Analytics Engine が有効なので、データセットをバインドし、InsightFlare 用の読み取り専用トークンを作成します。",
    "enableAnalyticsEngine": "Analytics Engine を開く",
    "updatePlanTitle": "更新内容",
    "updateFromTo": "{from} から {to} へ",
    "unknownVersion": "記録のないバージョン",
    "updatePendingMigrations": "適用するデータベースマイグレーション {count} 件",
    "updateNoMigrations": "データベースマイグレーションは不要です",
    "updateDestructive": "一部のマイグレーションは既存のテーブルを変更・削除します。最近のバックアップがあることを確認してください。",
    "updateDoMigration": "Durable Object のマイグレーションを含みます",
    "updateSafety": "新しいバージョンを先にアップロードし、データベースの準備ができてから切り替えます。ヘルスチェックに失敗した場合は自動的に以前のバージョンへ戻します。",
    "legacyAdopt": "このインスタンスは InsightFlare Deploy 以前に構築されました。今後 Deploy で管理することに同意します（データ・シークレット・バインディングは保持されます）。",
    "upToDate": "このインスタンスは最新の公式ビルドです。必要なら下でカスタムドメインを追加できます。",
    "upToDateReaderMissing": "このインスタンスは最新の公式ビルドですが、Analytics Engine の読み取りが未設定です。更新を実行すると自動で設定されます。",
    "planAnalyticsReader": "Analytics Engine の読み取り専用トークンを作成して Worker に保存",
    "note_AE_READER_PRESENT": "設定済み",
    "readerScopeMissingTitle": "API トークン管理の権限が付与されていません",
    "readerScopeMissingBody": "Cloudflare の同意画面では「API トークン」がデフォルトで未選択のため、Analytics Engine 読み取り専用トークンを自動作成できません。再認可してチェックを入れるか、このまま続行できます。続行した場合もデータ収集は行われますが、リクエスト観測など Analytics Engine を読み取る画面は、「システム設定 → Analytics Engine」でトークンを追加するまで空のままです。",
    "reauthorize": "再認可する",
    "note_AE_READER_NOT_AUTHORIZED": "スキップ：この認可には API トークン管理が含まれていません",
    "upToDateAeOff": "このインスタンスは最新の公式ビルドですが、Analytics Engine なしでデプロイされています。更新を実行すると有効になります。",
    "planEnableAnalytics": "Analytics Engine を有効化",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "バインド済み、読み取り設定済み",
    "aeStatus_missing": "バインド済み、読み取り未設定",
    "aeStatus_switched_off": "デプロイ時に無効化",
    "aeStatus_not_bound": "未バインド",
    "aeDisabledTitle": "このアカウントでは Analytics Engine が有効になっていません",
    "aeDisabledInstallBody": "今インストールすると Analytics Engine なしでデプロイされます。データ収集は行われますが、リクエスト観測などの画面は、有効化して更新を実行するまで空のままです。有効化するには Analytics Engine のページを開き、右上の青い「Enable」ボタンをクリックしてから、ここで再チェックしてください。",
    "aeDisabledUpdateBody": "更新で有効にするには、先に Analytics Engine を有効化する必要があります。Analytics Engine のページを開き、右上の青い「Enable」ボタンをクリックしてから、ここで再チェックしてください。",
    "recheck": "再チェック",
    "blockersTitle": "まだ続行できません",
    "blocker_WORKER_CONFLICT": "insightflare という名前の Worker が既にありますが、InsightFlare ではありません。先に名前を変更するか削除してください。",
    "blocker_NIGHTLY_PENDING": "現在利用できる公式 Nightly ビルドがありません。しばらくしてから再試行してください。",
    "blocker_RELEASE_UNAVAILABLE": "公式ビルドをダウンロードまたは検証できませんでした。",
    "blocker_DATABASE_TAKEN": "insightflare という D1 データベースに既にデータがあります。インストール前に削除するか名前を変更してください。",
    "blocker_UPDATE_BLOCKED": "このインスタンスは自動更新できません。",
    "adminPasswordTitle": "管理者パスワード",
    "adminPasswordGenerate": "自動生成する（インストール完了時に一度だけ表示）",
    "adminPasswordCustom": "自分で設定する",
    "adminPasswordLabel": "パスワード",
    "adminPasswordRepeat": "パスワード（確認）",
    "adminPasswordHint": "8〜128 文字。admin としてサインインでき、後から変更できます。",
    "adminPasswordTooShort": "8〜128 文字で入力してください。",
    "adminPasswordMismatch": "パスワードが一致しません。",
    "adminCustomDesc": "セットアップ時に設定したパスワードで admin としてサインインしてください。",
    "installButton": "InsightFlare をインストール",
    "updateButton": "InsightFlare を更新",
    "confirmInstallTitle": "今すぐ InsightFlare をインストールしますか？",
    "confirmInstallDesc": "{account} に上記のリソースを作成します。通常数分かかります。",
    "confirmUpdateTitle": "今すぐ InsightFlare を更新しますか？",
    "confirmUpdateDesc": "データベースマイグレーションは自動では元に戻せません。更新中も InsightFlare はトラフィックを処理し続けます。",
    "confirm": "確定",
    "cancel": "キャンセル",
    "deployTitle": "デプロイ中",
    "deployDesc": "このページを開いたままにしてください。閉じても、戻れば中断したところから再開します。",
    "runStep_verify": "公式ビルドとアカウントを検証",
    "runStep_database": "D1 データベースを準備",
    "runStep_kv": "KV 名前空間を準備",
    "runStep_migrate": "データベースマイグレーションを適用",
    "runStep_worker": "Worker をアップロード",
    "runStep_schedules": "スケジュールタスクを設定",
    "runStep_subdomain": "workers.dev アドレスを有効化",
    "runStep_analytics": "Analytics Engine の読み取りを設定",
    "runStep_health": "InsightFlare の応答を確認",
    "runStep_stage": "新バージョンをアップロード（未公開）",
    "runStep_activate": "トラフィックを新バージョンへ切り替え",
    "statusPending": "待機中",
    "statusRunning": "実行中",
    "statusDone": "完了",
    "statusSkipped": "スキップ",
    "statusWarning": "要確認",
    "statusFailed": "失敗",
    "note_CREATED": "{name} を作成しました",
    "note_REUSED": "既存のものを使用",
    "note_MIGRATIONS": "{total} 件中 {applied} 件を適用",
    "note_CRONS": "スケジュールタスクを {count} 件設定しました",
    "note_URL": "{url} で利用可能",
    "note_AE_NOT_ENABLED": "このアカウントでは Analytics Engine が有効になっていないため、除外しました",
    "note_AE_ENABLED": "このインスタンスで Analytics Engine を有効にしました",
    "note_AE_READER_CONFIGURED": "読み取り専用トークンを作成し Worker シークレットに保存しました",
    "note_AE_READER_MANUAL": "トークンを自動作成できませんでした。InsightFlare の設定で追加してください",
    "note_WORKERS_DEV_MISSING": "このアカウントには workers.dev サブドメインがありません",
    "note_NO_PUBLIC_URL": "確認できる公開アドレスがありません",
    "note_HEALTHY": "InsightFlare は応答しています",
    "note_WAITING": "アドレスの公開を待機中（{attempt}/{total}）",
    "note_HEALTH_TIMEOUT": "まだ応答がありません。新しいアドレスは数分かかることがあります",
    "note_ALREADY_CURRENT": "最新です",
    "note_ROLLED_BACK": "ヘルスチェックに失敗したため、以前のバージョンに戻しました",
    "runFailedTitle": "デプロイが停止しました",
    "runFailedDesc": "ここまで完了した内容は保持されます。必要に応じて問題を解決し、この手順から再試行してください。",
    "runSourceMovedDesc": "このデプロイの開始後に新しい公式ビルドが公開されました。最初からやり直すと新しいビルドをデプロイします。完了した手順（データベースマイグレーションなど）は繰り返されません。",
    "rolledBackDesc": "新バージョンがヘルスチェックに通らなかったため、以前のバージョンがトラフィックを処理しています。実行済みのデータベースマイグレーションは保持されます。",
    "retry": "再試行",
    "startOver": "最初からやり直す",
    "otherTab": "このデプロイは別のタブで処理中です。このページにも進捗が表示されます。",
    "reconnectNeeded": "Cloudflare の認可が期限切れになりました。再接続すれば続行できます（進捗は失われません）。",
    "doneInstallTitle": "InsightFlare をインストールしました",
    "doneUpdateTitle": "InsightFlare を更新しました",
    "doneDesc": "公式ビルド {sha} を実行中です。",
    "openDashboard": "InsightFlare を開く",
    "adminTitle": "管理者のサインイン情報",
    "adminDesc": "ここでのみ表示されます。今すぐパスワードを保存し、初回サインイン後に変更してください。",
    "username": "ユーザー名",
    "password": "パスワード",
    "passwordSaved": "パスワードを保存しました",
    "passwordForgotten": "パスワードは表示されなくなりました。紛失した場合は、InsightFlare リポジトリの ops:admin:reset-password スクリプトでリセットできます。",
    "followUpTitle": "残りの作業",
    "followAeEnable": "Analytics Engine を有効化し（ページを開いて右上の青い「Enable」ボタンをクリック）、ここで更新を実行すると、リクエスト観測などの分析が有効になります。",
    "followAeReader": "InsightFlare の「システム設定 → Analytics Engine」で Account Analytics Read 権限の API トークンを追加するか、「API トークン」にチェックを入れて再認可してから、ここで更新を実行してください。",
    "followWorkersDev": "Cloudflare ダッシュボードで insightflare Worker にカスタムドメインを追加するか、workers.dev サブドメインを登録してください。",
    "followHealth": "アドレスはまだ応答していません。数分待ってから開いてください。",
    "openCloudflare": "Cloudflare ダッシュボードを開く",
    "finish": "完了",
    "updateSafetyConfigure": "上記の変更だけを適用します。新しいバージョンはアップロードされず、InsightFlare はそのままトラフィックを処理し続けます。",
    "confirmUpdateNoMigrationDesc": "新しいバージョンをアップロードし、検証後に切り替えます。ヘルスチェックに失敗した場合は以前のバージョンに戻します。更新中も InsightFlare はトラフィックを処理し続けます。",
    "confirmConfigureTitle": "今すぐこれらの変更を適用しますか？",
    "confirmConfigureDesc": "Analytics Engine 読み取り専用トークンの作成やドメインの割り当てなど、上記の変更だけを適用します。新しいバージョンはアップロードされず、データも変更されません。",
    "configureButton": "変更を適用",
    "domainTitle": "アドレス",
    "domainCurrent": "現在のドメイン：{list}",
    "domainUseWorkersDev": "workers.dev のアドレスを使用",
    "domainKeep": "現在のアドレスのまま",
    "domainUseCustom": "自分のドメインを使用",
    "domainAddCustom": "自分のドメインを追加",
    "domainSubdomain": "サブドメイン（空欄ならドメインそのもの）",
    "domainZone": "ドメイン",
    "domainZonePlaceholder": "ドメインを選択",
    "domainHint": "この Cloudflare アカウントのドメインから選んでください。DNS レコードと証明書は Cloudflare が自動で作成します。",
    "domainPreview": "InsightFlare は https://{host} で提供されます。DNS レコードと証明書は Cloudflare が自動で作成します。既に別のレコードがある場合は拒否されます。",
    "domainAlready": "https://{host} は既に InsightFlare を指しています。",
    "domainInvalid": "サブドメインに使えるのは英数字・ハイフン・ドットのみです。",
    "planDomain": "https://{host} を InsightFlare に割り当て",
    "runStep_domain": "カスタムドメインを割り当て",
    "note_DOMAIN_ATTACHED": "https://{host} を割り当てました",
    "note_DOMAIN_FAILED": "{host} を割り当てられませんでした",
    "followDomain": "{host} を割り当てられませんでした。多くの場合、そのホスト名に既に DNS レコードがあることが原因です。そのレコードを削除・変更してからここで更新を実行するか、Cloudflare ダッシュボードで insightflare Worker にドメインを追加してください。",
    "domainNoZones": "この Cloudflare アカウントにはまだ有効なドメインがありません。ドメインをアカウントに追加してからここで InsightFlare に割り当ててください。それまでは workers.dev のアドレスを使用します。",
    "domainZonesError": "このアカウントのドメインを読み取れませんでした（{error}）。再認可するか、後で割り当ててください。それまでは workers.dev のアドレスを使用します。",
    "uninstallTitle": "InsightFlare をアンインストール",
    "uninstallReviewDesc": "削除対象のリソースを確認してください。",
    "uninstallButton": "アンインストール",
    "uninstallCleanup": "失敗したインストールをクリーンアップ",
    "uninstallConfirmTitle": "InsightFlare を完全に削除しますか？",
    "uninstallWarning": "一覧の Worker、D1 データ、KV 設定（ユーザーと分析データを含む）を完全に削除します。Durable Objects の状態や Worker シークレットが失われる場合があります。必要なデータは事前にバックアップしてください。",
    "uninstallResources": "削除対象リソース",
    "uninstallResidual": "Analytics Engine の履歴、API トークン、および所有を確認できないリソースや外部リソースは保持されます。Cloudflare で個別に確認してください。",
    "uninstallTypeName": "確認のため insightflare と入力",
    "uninstallRunning": "アンインストール中",
    "uninstallDoneTitle": "InsightFlare をアンインストールしました",
    "uninstallDoneDesc": "確認対象の Worker とストレージが存在しないことを確認しました。",
    "uninstallFailedDesc": "アンインストールが停止しました。完了した削除は元に戻せません。再試行すると失敗した手順から再開します。",
    "runStep_removeWorker": "Worker と関連リソースを削除",
    "runStep_removeDatabase": "確認済みの D1 データベースを削除",
    "runStep_removeKv": "確認済みの KV 名前空間を削除",
    "runStep_verifyRemoval": "リソースの削除を確認",
    "runStep_removeDomains": "残っている確認済みカスタムドメインを解除"
  }
};
const DICTIONARIES: Record<Locale,AppMessages> = {
  "en": enMessages,
  "zh": zhMessages,
  "zh-tw": zh_twMessages,
  "ja": jaMessages,
};
export function getMessages(locale: Locale): AppMessages { return DICTIONARIES[locale]; }
export type DeployMessageKey = keyof AppMessages["deploy"];
