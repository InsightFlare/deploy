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
    "permissionsBody": "Create and update the insightflare Worker, its D1 database and KV namespace, and create one read-only Analytics Engine token. The authorization expires within an hour and is never stored in plain text.",
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
    "resumeRun": "A deployment for this account is in progress or waiting for you. Continue to see it.",
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
    "planAnalytics": "Analytics Engine datasets, if Analytics Engine is enabled on the account, plus a read-only token for them",
    "planAnalyticsNote": "Analytics Engine must be enabled once per account in the Cloudflare dashboard. If it is not, InsightFlare installs without it and you can enable it later.",
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
    "upToDate": "This installation already runs the latest official build.",
    "upToDateReaderMissing": "This installation already runs the latest official build, but Analytics Engine reading is not configured yet. Run an update to set it up automatically.",
    "planAnalyticsReader": "Create a read-only Analytics Engine token and store it in the Worker",
    "note_AE_READER_PRESENT": "Already configured",
    "readerScopeMissingTitle": "API token permission not granted",
    "readerScopeMissingBody": "Cloudflare leaves \"API Tokens\" unticked on the consent page, so Deploy cannot create the read-only Analytics Engine token. You can re-authorize and tick it, or continue without it: InsightFlare still collects analytics, but request observation and other views that read Analytics Engine stay empty until you add a token under Settings → Analytics Engine.",
    "reauthorize": "Re-authorize",
    "note_AE_READER_NOT_AUTHORIZED": "Skipped: the authorization does not include API token management",
    "upToDateAeOff": "This installation already runs the latest official build, but it was deployed without Analytics Engine. Run an update to switch it on if your account has enabled Analytics Engine.",
    "planEnableAnalytics": "Switch Analytics Engine on (if the account has enabled it)",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "bound, reader configured",
    "aeStatus_missing": "bound, reader not configured",
    "aeStatus_switched_off": "switched off when it was deployed",
    "aeStatus_not_bound": "not bound",
    "blockersTitle": "This cannot continue yet",
    "blocker_WORKER_CONFLICT": "A Worker named insightflare already exists but is not an InsightFlare installation. Rename or remove it first.",
    "blocker_NIGHTLY_PENDING": "The newest official build is still being published. Try again in a few minutes.",
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
    "confirmUpdateDesc": "Database migrations cannot be undone automatically. The Worker keeps serving traffic during the update.",
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
    "runStep_analytics": "Connect Analytics Engine reading",
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
    "note_CRONS": "{count} schedule set",
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
    "passwordForgotten": "The password is no longer shown. If you lost it, reset it with the ops:admin:reset-password command.",
    "followUpTitle": "Things to finish",
    "followAeEnable": "Enable Analytics Engine in Cloudflare, then run an update here to turn on request observation and the related analytics.",
    "followAeReader": "Add an API token with Account Analytics Read under Settings → Analytics Engine in InsightFlare.",
    "followWorkersDev": "Add a custom domain to the insightflare Worker, or register a workers.dev subdomain, in the Cloudflare dashboard.",
    "followHealth": "The address did not respond yet. Give it a few minutes, then open it.",
    "openCloudflare": "Open Cloudflare dashboard",
    "finish": "Finish"
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
    "permissionsBody": "创建和更新名为 insightflare 的 Worker 及其 D1 数据库、KV 命名空间，并创建一个只能读取 Analytics Engine 的 token。授权一小时内过期，且不会以明文保存。",
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
    "resumeRun": "这个账号有一次部署正在进行或等待处理，继续即可查看。",
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
    "planAnalytics": "Analytics Engine 数据集（账号已开启 Analytics Engine 时），以及一个只读 token",
    "planAnalyticsNote": "Analytics Engine 需要在 Cloudflare 控制台为每个账号手动开启一次。如果还没开启，InsightFlare 会先不带它安装，之后可以再开启。",
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
    "upToDate": "这个实例已经是最新的官方构建。",
    "upToDateReaderMissing": "这个实例已经是最新的官方构建，但还没有配置 Analytics Engine 读取。执行一次更新即可自动配置。",
    "planAnalyticsReader": "创建 Analytics Engine 只读 token 并写入 Worker",
    "note_AE_READER_PRESENT": "已配置过",
    "readerScopeMissingTitle": "未授予 API 令牌管理权限",
    "readerScopeMissingBody": "Cloudflare 授权页默认不勾选“API 令牌”权限，所以无法自动创建 Analytics Engine 只读 token。你可以重新授权并勾选它，也可以直接继续：InsightFlare 照常采集数据，但请求观测等需要读取 Analytics Engine 的页面会没有数据，直到你在“设置 → 分析引擎”中手动填写 token。",
    "reauthorize": "重新授权",
    "note_AE_READER_NOT_AUTHORIZED": "已跳过：本次授权不包含 API 令牌管理权限",
    "upToDateAeOff": "这个实例已经是最新的官方构建，但部署时没有开启 Analytics Engine。如果账号已经开启 Analytics Engine，执行一次更新即可开启。",
    "planEnableAnalytics": "开启 Analytics Engine（账号已开启时）",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "已绑定，读取已配置",
    "aeStatus_missing": "已绑定，读取未配置",
    "aeStatus_switched_off": "部署时未开启",
    "aeStatus_not_bound": "未绑定",
    "blockersTitle": "暂时无法继续",
    "blocker_WORKER_CONFLICT": "已经有一个名为 insightflare 的 Worker，但它不是 InsightFlare。请先重命名或删除它。",
    "blocker_NIGHTLY_PENDING": "最新的官方构建还在发布中，请几分钟后再试。",
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
    "confirmUpdateDesc": "数据库迁移无法自动撤销。更新期间 Worker 会继续正常提供服务。",
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
    "passwordForgotten": "密码已不再显示。如果遗失，可以用 ops:admin:reset-password 命令重置。",
    "followUpTitle": "还需要处理",
    "followAeEnable": "在 Cloudflare 中开启 Analytics Engine，然后回到这里执行一次更新，即可启用请求观测等相关分析。",
    "followAeReader": "在 InsightFlare 的“设置 → 分析引擎”中填写一个带 Account Analytics Read 权限的 API Token。",
    "followWorkersDev": "在 Cloudflare 控制台为 insightflare Worker 绑定自定义域名，或注册 workers.dev 子域名。",
    "followHealth": "地址暂时还没有响应，请过几分钟再打开。",
    "openCloudflare": "打开 Cloudflare 控制台",
    "finish": "完成"
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
    "permissionsBody": "建立和更新名為 insightflare 的 Worker 及其 D1 資料庫、KV 命名空間，並建立一個只能讀取 Analytics Engine 的 token。授權一小時內過期，且不會以明文保存。",
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
    "resumeRun": "這個帳號有一次部署正在進行或等待處理，繼續即可查看。",
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
    "planAnalytics": "Analytics Engine 資料集（帳號已開啟 Analytics Engine 時），以及一個唯讀 token",
    "planAnalyticsNote": "Analytics Engine 需要在 Cloudflare 控制台為每個帳號手動開啟一次。如果還沒開啟，InsightFlare 會先不帶它安裝，之後可以再開啟。",
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
    "upToDate": "這個實例已經是最新的官方建置。",
    "upToDateReaderMissing": "這個實例已經是最新的官方建置，但還沒有設定 Analytics Engine 讀取。執行一次更新即可自動設定。",
    "planAnalyticsReader": "建立 Analytics Engine 唯讀 token 並寫入 Worker",
    "note_AE_READER_PRESENT": "已設定過",
    "readerScopeMissingTitle": "未授予 API 權杖管理權限",
    "readerScopeMissingBody": "Cloudflare 授權頁預設不勾選「API 權杖」權限，所以無法自動建立 Analytics Engine 唯讀 token。你可以重新授權並勾選它，也可以直接繼續：InsightFlare 照常收集資料，但請求觀測等需要讀取 Analytics Engine 的頁面會沒有資料，直到你在「設定 → 分析引擎」中手動填寫 token。",
    "reauthorize": "重新授權",
    "note_AE_READER_NOT_AUTHORIZED": "已略過：本次授權不包含 API 權杖管理權限",
    "upToDateAeOff": "這個實例已經是最新的官方建置，但部署時沒有開啟 Analytics Engine。如果帳號已經開啟 Analytics Engine，執行一次更新即可開啟。",
    "planEnableAnalytics": "開啟 Analytics Engine（帳號已開啟時）",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "已綁定，讀取已設定",
    "aeStatus_missing": "已綁定，讀取未設定",
    "aeStatus_switched_off": "部署時未開啟",
    "aeStatus_not_bound": "未綁定",
    "blockersTitle": "暫時無法繼續",
    "blocker_WORKER_CONFLICT": "已經有一個名為 insightflare 的 Worker，但它不是 InsightFlare。請先重新命名或刪除它。",
    "blocker_NIGHTLY_PENDING": "最新的官方建置還在發布中，請幾分鐘後再試。",
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
    "confirmUpdateDesc": "資料庫遷移無法自動復原。更新期間 Worker 會繼續正常提供服務。",
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
    "passwordForgotten": "密碼已不再顯示。如果遺失，可以用 ops:admin:reset-password 命令重設。",
    "followUpTitle": "還需要處理",
    "followAeEnable": "在 Cloudflare 中開啟 Analytics Engine，然後回到這裡執行一次更新，即可啟用請求觀測等相關分析。",
    "followAeReader": "在 InsightFlare 的「設定 → 分析引擎」中填寫一個帶 Account Analytics Read 權限的 API Token。",
    "followWorkersDev": "在 Cloudflare 控制台為 insightflare Worker 綁定自訂網域，或註冊 workers.dev 子網域。",
    "followHealth": "網址暫時還沒有回應，請過幾分鐘再開啟。",
    "openCloudflare": "開啟 Cloudflare 控制台",
    "finish": "完成"
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
    "permissionsBody": "insightflare Worker とその D1 データベース・KV 名前空間の作成と更新、および Analytics Engine 読み取り専用トークンの作成を行います。認可は 1 時間以内に失効し、平文で保存されることはありません。",
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
    "resumeRun": "このアカウントには進行中または確認待ちのデプロイがあります。次へ進んで確認してください。",
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
    "planAnalytics": "Analytics Engine データセット（アカウントで有効な場合）と読み取り専用トークン",
    "planAnalyticsNote": "Analytics Engine はアカウントごとに一度 Cloudflare ダッシュボードで有効化する必要があります。未有効の場合は Analytics Engine なしでインストールされ、後から有効化できます。",
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
    "upToDate": "このインスタンスは最新の公式ビルドを実行しています。",
    "upToDateReaderMissing": "このインスタンスは最新の公式ビルドですが、Analytics Engine の読み取りが未設定です。更新を実行すると自動で設定されます。",
    "planAnalyticsReader": "Analytics Engine の読み取り専用トークンを作成して Worker に保存",
    "note_AE_READER_PRESENT": "設定済み",
    "readerScopeMissingTitle": "API トークン管理の権限が付与されていません",
    "readerScopeMissingBody": "Cloudflare の同意画面では「API トークン」がデフォルトで未選択のため、Analytics Engine の読み取り専用トークンを自動作成できません。再認可してチェックを入れるか、このまま続行できます。続行した場合もデータ収集は行われますが、リクエスト観測など Analytics Engine を読み取る画面は、「設定 → Analytics Engine」でトークンを追加するまで空のままです。",
    "reauthorize": "再認可する",
    "note_AE_READER_NOT_AUTHORIZED": "スキップ：この認可には API トークン管理が含まれていません",
    "upToDateAeOff": "このインスタンスは最新の公式ビルドですが、Analytics Engine なしでデプロイされています。アカウントで Analytics Engine を有効にしている場合は、更新を実行すると有効になります。",
    "planEnableAnalytics": "Analytics Engine を有効化（アカウントで有効な場合）",
    "aeStatusLabel": "Analytics Engine",
    "aeStatus_configured": "バインド済み、読み取り設定済み",
    "aeStatus_missing": "バインド済み、読み取り未設定",
    "aeStatus_switched_off": "デプロイ時に無効化",
    "aeStatus_not_bound": "未バインド",
    "blockersTitle": "まだ続行できません",
    "blocker_WORKER_CONFLICT": "insightflare という名前の Worker が既にありますが、InsightFlare ではありません。先に名前を変更するか削除してください。",
    "blocker_NIGHTLY_PENDING": "最新の公式ビルドを公開中です。数分後にもう一度お試しください。",
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
    "confirmUpdateDesc": "データベースマイグレーションは自動では元に戻せません。更新中も Worker はトラフィックを処理し続けます。",
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
    "note_CRONS": "{count} 件のスケジュールを設定",
    "note_URL": "{url} で利用可能",
    "note_AE_NOT_ENABLED": "このアカウントでは Analytics Engine が無効のため除外しました",
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
    "passwordForgotten": "パスワードは表示されなくなりました。紛失した場合は ops:admin:reset-password コマンドでリセットできます。",
    "followUpTitle": "残りの作業",
    "followAeEnable": "Cloudflare で Analytics Engine を有効にしてから、ここで更新を実行すると、リクエスト観測などの分析が有効になります。",
    "followAeReader": "InsightFlare の「設定 → Analytics Engine」で Account Analytics Read 権限の API トークンを追加してください。",
    "followWorkersDev": "Cloudflare ダッシュボードで insightflare Worker にカスタムドメインを追加するか、workers.dev サブドメインを登録してください。",
    "followHealth": "アドレスはまだ応答していません。数分待ってから開いてください。",
    "openCloudflare": "Cloudflare ダッシュボードを開く",
    "finish": "完了"
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
