// @generated from src/i18n/*.yaml by scripts/generate-i18n.mjs.
import type { Locale } from "./config";

export interface AppMessages {
  "deploy": {
    "brand": string;
    "tagline": string;
    "wizard": string;
    "wizardHelp": string;
    "language": string;
    "connected": string;
    "disconnected": string;
    "next": string;
    "back": string;
    "close": string;
    "refresh": string;
    "viewCommit": string;
    "sourceGitHub": string;
    "previous": string;
    "stepCount": string;
    "progress": string;
    "completed": string;
    "current": string;
    "upcoming": string;
    "needsAttention": string;
    "working": string;
    "loading": string;
    "unavailable": string;
    "unknown": string;
    "yes": string;
    "no": string;
    "available": string;
    "missing": string;
    "ready": string;
    "pending": string;
    "dismiss": string;
    "stepConnect": string;
    "stepAccount": string;
    "stepSource": string;
    "stepD1": string;
    "stepStage": string;
    "stepActivate": string;
    "connectTitle": string;
    "connectDesc": string;
    "connectButton": string;
    "oauthMissing": string;
    "connectedDesc": string;
    "disconnect": string;
    "dataPromise": string;
    "accountTitle": string;
    "accountDesc": string;
    "accountLabel": string;
    "accountPlaceholder": string;
    "discovering": string;
    "noInstallation": string;
    "managed": string;
    "legacy": string;
    "conflict": string;
    "worker": string;
    "deployedSha": string;
    "sourceTitle": string;
    "sourceDesc": string;
    "sourceBranch": string;
    "sourceCommit": string;
    "sourceLoading": string;
    "sourceMissing": string;
    "commitDate": string;
    "buildTitle": string;
    "buildDesc": string;
    "repoVerified": string;
    "planTitle": string;
    "planDesc": string;
    "operation": string;
    "install": string;
    "update": string;
    "repair": string;
    "previewPlan": string;
    "freezeSha": string;
    "planSteps": string;
    "planBlockers": string;
    "noPlan": string;
    "resourceActions": string;
    "resourceBlockers": string;
    "prepared": string;
    "preparedUntil": string;
    "preparedHint": string;
    "d1Title": string;
    "d1Desc": string;
    "d1Label": string;
    "d1Placeholder": string;
    "inspectMigrations": string;
    "verifyD1": string;
    "schemaCurrent": string;
    "migrationApplied": string;
    "migrationPending": string;
    "migrationTotal": string;
    "recoveryPoint": string;
    "migrationRisk": string;
    "migrationReview": string;
    "migrationAdd": string;
    "applyMigrations": string;
    "applyingMigrations": string;
    "authD1Read": string;
    "authD1Write": string;
    "d1ScopeHint": string;
    "d1Progress": string;
    "d1Complete": string;
    "d1ContinueHint": string;
    "stageTitle": string;
    "stageDesc": string;
    "inspectVersion": string;
    "authDeploy": string;
    "nightlyCandidate": string;
    "inactive": string;
    "activeVersion": string;
    "migrationTag": string;
    "bindingsPreserved": string;
    "legacyApprove": string;
    "uploadInactive": string;
    "uploading": string;
    "findPrevious": string;
    "previousCandidates": string;
    "useCandidate": string;
    "stagedReady": string;
    "stageSafety": string;
    "stageRestoreEmpty": string;
    "stageRestored": string;
    "stageContinueHint": string;
    "activateTitle": string;
    "activateDesc": string;
    "activationTarget": string;
    "activationNeedD1": string;
    "activate100": string;
    "activationSuccess": string;
    "deploymentId": string;
    "versionId": string;
    "activationNote": string;
    "installUnavailable": string;
    "installUnavailableHint": string;
    "actionConfirmD1": string;
    "actionConfirmStage": string;
    "actionConfirmActivate": string;
    "activationNoCandidate": string;
    "authFailed": string;
    "unexpectedError": string;
    "httpError": string;
    "invalidResponse": string;
    "requestFailed": string;
    "showTechnical": string;
    "stageFinish": string;
    "stepBlocked": string;
    "theme": string;
    "lightTheme": string;
    "darkTheme": string;
    "systemTheme": string;
    "cancel": string;
    "confirm": string;
    "confirmStageTitle": string;
    "confirmD1Title": string;
    "confirmActivateTitle": string;
    "languageSelect": string;
    "confirmActionHint": string;
    "sourceTitleShort": string;
    "stateNotInstalled": string;
    "stateMissingWorkerTag": string;
    "statePermissionRequired": string;
    "stateNotConfigured": string;
    "stateRepositoryMismatch": string;
    "stateUnsafeTrigger": string;
    "stateCandidate": string;
    "apiPlan1": string;
    "apiPlan2": string;
    "apiPlan3": string;
    "apiPlan4": string;
    "apiPlan5": string;
    "apiPlan6": string;
    "apiPlan7": string;
    "apiBlocker1": string;
    "apiBlocker2": string;
    "apiBlocker3": string;
    "apiBlocker4": string;
    "apiBlocker5": string;
    "apiBlocker6": string;
    "apiIssue1": string;
    "apiIssue2": string;
    "apiIssue3": string;
    "resourceCreate": string;
    "resourcePreserve": string;
    "resourceBlock": string;
    "resourceOptional": string;
    "resourceUnknownOwnership": string;
    "resourceUnexpectedBinding": string;
    "resourceExistingRequired": string;
    "resourceKeepSecret": string;
    "resourceCreateD1": string;
    "resourceKeepD1": string;
    "resourceCreateKv": string;
    "resourceKeepKv": string;
    "resourceCreateDo": string;
    "resourceKeepDo": string;
    "resourceCreateSecret": string;
    "resourceKeepRootSecret": string;
    "requiredBindingMissing": string;
  };
};
const enMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "Your analytics, your Cloudflare account.",
    "wizard": "Deployment assistant",
    "wizardHelp": "One step at a time. Your existing Worker keeps running until you approve activation.",
    "language": "Language",
    "connected": "Connected",
    "disconnected": "Not connected",
    "next": "Continue",
    "back": "Back",
    "close": "Close",
    "refresh": "Refresh",
    "viewCommit": "View commit",
    "sourceGitHub": "View project on GitHub",
    "previous": "Previous step",
    "stepCount": "Step {current} of {total}",
    "progress": "Setup progress",
    "completed": "Completed",
    "current": "Current",
    "upcoming": "Upcoming",
    "needsAttention": "Requires attention",
    "working": "Working…",
    "loading": "Loading…",
    "unavailable": "Unavailable",
    "unknown": "Unknown",
    "yes": "Yes",
    "no": "No",
    "available": "Available",
    "missing": "Missing",
    "ready": "Ready",
    "pending": "Pending",
    "dismiss": "Dismiss",
    "stepConnect": "Connect",
    "stepAccount": "Account",
    "stepSource": "Review",
    "stepD1": "Database",
    "stepStage": "Stage",
    "stepActivate": "Activate",
    "connectTitle": "Connect your Cloudflare account",
    "connectDesc": "Sign in with Cloudflare to discover your existing InsightFlare installation. We request additional permissions only when needed.",
    "connectButton": "Connect with Cloudflare",
    "oauthMissing": "OAuth is not configured for this service.",
    "connectedDesc": "Your Cloudflare session is active. Continue to select the account to manage.",
    "disconnect": "Disconnect",
    "dataPromise": "Your analytics data stays inside your Cloudflare account.",
    "accountTitle": "Choose the account to manage",
    "accountDesc": "We detect an InsightFlare Worker directly from the selected Cloudflare account.",
    "accountLabel": "Cloudflare account",
    "accountPlaceholder": "Select an account",
    "discovering": "Discovering existing installation…",
    "noInstallation": "Not installed",
    "managed": "Managed installation",
    "legacy": "Existing instance · approval required",
    "conflict": "Worker name conflict",
    "worker": "Worker",
    "deployedSha": "Deployed source",
    "sourceTitle": "Review the official Nightly",
    "sourceDesc": "Every operation is pinned to the current official main commit. Inspect the plan before changing infrastructure.",
    "sourceBranch": "Source branch",
    "sourceCommit": "Official commit",
    "sourceLoading": "Retrieving latest commit…",
    "sourceMissing": "Source commit unavailable",
    "commitDate": "Committed {date}",
    "buildTitle": "Build integration",
    "buildDesc": "The official Nightly artifact is built on GitHub; no user-side Docker or compilation is required.",
    "repoVerified": "Repository identity",
    "planTitle": "Review deployment plan",
    "planDesc": "A read-only preview. Preparing a run does not install or update anything.",
    "operation": "Operation",
    "install": "Install from main",
    "update": "Update to main",
    "repair": "Repair current commit",
    "previewPlan": "Preview plan",
    "freezeSha": "Freeze reviewed SHA",
    "planSteps": "Planned steps",
    "planBlockers": "Plan limitations",
    "noPlan": "Select an account to preview a deployment plan.",
    "resourceActions": "Resource reconciliation",
    "resourceBlockers": "{count} resource blockers",
    "prepared": "Prepared operation · not deployed",
    "preparedUntil": "Pinned SHA expires at {time}",
    "preparedHint": "Preparing does not modify Cloudflare resources.",
    "d1Title": "Review D1 migrations",
    "d1Desc": "Inspect the official SQL files, then apply pending migrations separately. The existing Worker stays online.",
    "d1Label": "D1 database",
    "d1Placeholder": "Choose a database",
    "inspectMigrations": "Inspect migrations",
    "verifyD1": "Verifying Nightly and D1…",
    "schemaCurrent": "Schema is current",
    "migrationApplied": "Applied",
    "migrationPending": "Pending",
    "migrationTotal": "Official SQL files",
    "recoveryPoint": "Recovery bookmark",
    "migrationRisk": "Some migrations alter existing schema or data. Confirm compatibility before applying; the existing Worker continues serving.",
    "migrationReview": "Review",
    "migrationAdd": "Add",
    "applyMigrations": "Apply pending D1 migrations",
    "applyingMigrations": "Applying migrations…",
    "authD1Read": "Authorize D1 Read",
    "authD1Write": "Authorize D1 Write",
    "d1ScopeHint": "This requires explicit Cloudflare consent. Read-only inspection does not request D1 Write.",
    "d1Progress": "Applied {applied}, {remaining} remaining",
    "d1Complete": "D1 migrations are complete. Worker activation is separate.",
    "d1ContinueHint": "Refresh the D1 preview after an interrupted migration before proceeding.",
    "stageTitle": "Stage a Worker version",
    "stageDesc": "Upload and verify the Nightly Worker without sending any traffic to it.",
    "inspectVersion": "Inspect Worker version",
    "authDeploy": "Authorize Workers Write + D1",
    "nightlyCandidate": "Official Nightly candidate",
    "inactive": "Not active",
    "activeVersion": "Active Worker version",
    "migrationTag": "DO migration tag",
    "bindingsPreserved": "Existing bindings preserved: {count}",
    "legacyApprove": "I reviewed this existing unmanaged Worker and approve adopting it without replacing its D1, KV, DO or Secrets.",
    "uploadInactive": "Upload inactive version",
    "uploading": "Uploading…",
    "findPrevious": "Find previous upload",
    "previousCandidates": "Staged versions",
    "useCandidate": "Select version",
    "stagedReady": "Version staged · ready for review",
    "stageSafety": "D1, KV, DO and Secrets remain unchanged. No new Worker traffic is enabled.",
    "stageRestoreEmpty": "No compatible staged versions found. Upload the Nightly candidate first.",
    "stageRestored": "Compatible candidates recovered from Cloudflare version history.",
    "stageContinueHint": "The current Worker remains live until you explicitly activate the new version.",
    "activateTitle": "Review and activate",
    "activateDesc": "Final checkpoint. Check the target version and database before switching 100% of Worker traffic.",
    "activationTarget": "Candidate version",
    "activationNeedD1": "Inspect the matching D1 database and apply pending Nightly SQL before activating.",
    "activate100": "Activate at 100% traffic",
    "activationSuccess": "Worker version successfully activated",
    "deploymentId": "Deployment ID",
    "versionId": "Version ID",
    "activationNote": "Activation does not update Cloudflare Cron triggers or custom routes.",
    "installUnavailable": "New installation is not enabled yet",
    "installUnavailableHint": "Creating D1, KV and other resources for a fresh installation is still under development. Existing installations can use the upgrade flow.",
    "actionConfirmD1": "Apply {count} migrations to {target}? The existing Worker will continue serving.",
    "actionConfirmStage": "Upload official source {sha} as an inactive Worker version? Existing bindings are preserved.",
    "actionConfirmActivate": "Activate version {version} at 100% traffic? This switches the live Worker deployment.",
    "activationNoCandidate": "A staged candidate is required before activation.",
    "authFailed": "Cloudflare authorization failed: {error}",
    "unexpectedError": "Unexpected error",
    "httpError": "Request failed (HTTP {status})",
    "invalidResponse": "Invalid API response",
    "requestFailed": "The operation failed; review details and retry.",
    "showTechnical": "Technical details",
    "stageFinish": "You're up to date",
    "stepBlocked": "Complete the current step before continuing.",
    "theme": "Theme",
    "lightTheme": "Light",
    "darkTheme": "Dark",
    "systemTheme": "System",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "confirmStageTitle": "Upload inactive Worker version",
    "confirmD1Title": "Confirm D1 migrations",
    "confirmActivateTitle": "Activate the Worker version",
    "languageSelect": "Language",
    "confirmActionHint": "This is a separate operation that requires your approval.",
    "sourceTitleShort": "InsightFlare Deploy",
    "stateNotInstalled": "Not installed",
    "stateMissingWorkerTag": "Missing Worker tag",
    "statePermissionRequired": "Permission required",
    "stateNotConfigured": "Not configured",
    "stateRepositoryMismatch": "Repository mismatch",
    "stateUnsafeTrigger": "Unsafe build trigger",
    "stateCandidate": "Candidate",
    "apiPlan1": "Revalidate OAuth account and ownership",
    "apiPlan2": "Resolve and pin a single immutable source commit",
    "apiPlan3": "Download and verify the SHA-pinned official Nightly tar.gz",
    "apiPlan4": "Review and apply compatible forward-only D1 migrations",
    "apiPlan5": "Reconcile resources and upload Worker modules and assets",
    "apiPlan6": "Preserve all existing secrets, domain routes and user data",
    "apiPlan7": "Verify health and record the deployed commit SHA",
    "apiBlocker1": "Existing Worker upgrades are available through the D1 migration and Worker Versions panels; new-install resource provisioning and one-click full deployment plans are not enabled.",
    "apiBlocker2": "Worker name is occupied by an unknown application. Automatic takeover is forbidden.",
    "apiBlocker3": "Existing legacy instance must complete an explicit adoption flow.",
    "apiBlocker4": "An existing Worker must be reviewed before installation.",
    "apiBlocker5": "Nothing is installed in this account.",
    "apiBlocker6": "Repair requires a known managed deployment SHA.",
    "apiIssue1": "Worker identity or deployment marker cannot be verified. Refusing automatic takeover.",
    "apiIssue2": "Existing InsightFlare Worker has no managed deployment SHA; a safe adoption process is required.",
    "apiIssue3": "No standard Worker was returned by Cloudflare. Check that the authorization can list Workers before starting a new installation.",
    "resourceCreate": "Create",
    "resourcePreserve": "Preserve",
    "resourceBlock": "Block",
    "resourceOptional": "Optional",
    "resourceUnknownOwnership": "Worker ownership must be established before handling this resource.",
    "resourceUnexpectedBinding": "This binding has an unexpected type, identifier, or duplicate name. Manual review required.",
    "resourceExistingRequired": "Existing instance lacks this required binding; automatic replacement is forbidden.",
    "resourceKeepSecret": "Preserve existing secret metadata without reading, replacing or rotating its value.",
    "resourceCreateD1": "Create an isolated D1 database and apply reviewed schema migrations.",
    "resourceKeepD1": "Retain this exact D1 database ID and its existing contents.",
    "resourceCreateKv": "Create a KV namespace for site settings.",
    "resourceKeepKv": "Retain this exact KV namespace and all stored site settings.",
    "resourceCreateDo": "Create the IngestDurableObject SQLite namespace using the reviewed Worker migration.",
    "resourceKeepDo": "Preserve the existing Durable Object namespace and all actor state.",
    "resourceCreateSecret": "Generate a new cryptographically random secret; never send it to the browser.",
    "resourceKeepRootSecret": "Keep the existing secret binding without retrieving or rotating its value.",
    "requiredBindingMissing": "Required binding {name} is missing; cannot safely update."
  }
};
const zhMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare 部署",
    "tagline": "你的分析系统，部署在自己的 Cloudflare 账户。",
    "wizard": "部署向导",
    "wizardHelp": "逐步完成部署。确认激活之前，现有 Worker 会继续运行。",
    "language": "语言",
    "connected": "已连接",
    "disconnected": "未连接",
    "next": "继续",
    "back": "上一步",
    "close": "关闭",
    "refresh": "刷新",
    "viewCommit": "查看提交",
    "sourceGitHub": "在 GitHub 查看项目",
    "previous": "上一步",
    "stepCount": "第 {current} 步，共 {total} 步",
    "progress": "部署进度",
    "completed": "已完成",
    "current": "当前",
    "upcoming": "未开始",
    "needsAttention": "需要处理",
    "working": "处理中…",
    "loading": "加载中…",
    "unavailable": "不可用",
    "unknown": "未知",
    "yes": "是",
    "no": "否",
    "available": "可用",
    "missing": "缺失",
    "ready": "就绪",
    "pending": "待处理",
    "dismiss": "关闭提示",
    "stepConnect": "连接",
    "stepAccount": "账户",
    "stepSource": "检查",
    "stepD1": "数据库",
    "stepStage": "暂存",
    "stepActivate": "激活",
    "connectTitle": "连接 Cloudflare 账户",
    "connectDesc": "使用 Cloudflare 授权来发现已有的 InsightFlare 实例。额外权限只在需要时请求。",
    "connectButton": "使用 Cloudflare 连接",
    "oauthMissing": "此服务尚未配置 OAuth。",
    "connectedDesc": "Cloudflare 会话已连接。继续选择要管理的账户。",
    "disconnect": "断开连接",
    "dataPromise": "分析数据始终保存在你自己的 Cloudflare 账户中。",
    "accountTitle": "选择要管理的账户",
    "accountDesc": "从所选 Cloudflare 账户直接发现 InsightFlare Worker。",
    "accountLabel": "Cloudflare 账户",
    "accountPlaceholder": "选择账户",
    "discovering": "正在检查已有实例…",
    "noInstallation": "尚未安装",
    "managed": "已托管实例",
    "legacy": "已有实例 · 需要确认接管",
    "conflict": "Worker 名称冲突",
    "worker": "Worker",
    "deployedSha": "当前已部署版本",
    "sourceTitle": "检查官方 Nightly",
    "sourceDesc": "所有操作固定到官方 main 的最新提交。修改基础设施前可先检查计划。",
    "sourceBranch": "源码分支",
    "sourceCommit": "官方提交",
    "sourceLoading": "获取最新提交中…",
    "sourceMissing": "无法获取源版本",
    "commitDate": "提交于 {date}",
    "buildTitle": "构建集成",
    "buildDesc": "Nightly 由 GitHub 官方工作流构建，无需用户安装 Docker 或自行编译。",
    "repoVerified": "仓库身份",
    "planTitle": "检查部署计划",
    "planDesc": "这是只读预览。准备运行记录不会安装或升级任何资源。",
    "operation": "操作类型",
    "install": "从 main 安装",
    "update": "更新到 main",
    "repair": "修复当前版本",
    "previewPlan": "预览计划",
    "freezeSha": "固定已检查的 SHA",
    "planSteps": "计划步骤",
    "planBlockers": "计划限制",
    "noPlan": "选择账户后即可预览部署计划。",
    "resourceActions": "资源核对",
    "resourceBlockers": "{count} 项资源限制",
    "prepared": "已准备操作 · 尚未部署",
    "preparedUntil": "固定的 SHA 于 {time} 过期",
    "preparedHint": "准备操作不会修改 Cloudflare 资源。",
    "d1Title": "检查 D1 数据库迁移",
    "d1Desc": "先检查官方 SQL 文件，再单独执行待处理迁移。现有 Worker 继续运行。",
    "d1Label": "D1 数据库",
    "d1Placeholder": "选择数据库",
    "inspectMigrations": "检查迁移",
    "verifyD1": "正在验证 Nightly 和 D1…",
    "schemaCurrent": "数据库结构已是最新",
    "migrationApplied": "已应用",
    "migrationPending": "待执行",
    "migrationTotal": "官方 SQL 文件",
    "recoveryPoint": "恢复书签",
    "migrationRisk": "部分迁移会更改现有结构或数据。请在执行前确认兼容性；旧 Worker 不会停止服务。",
    "migrationReview": "检查",
    "migrationAdd": "新增",
    "applyMigrations": "执行待处理 D1 迁移",
    "applyingMigrations": "正在执行迁移…",
    "authD1Read": "授权 D1 读取",
    "authD1Write": "授权 D1 写入",
    "d1ScopeHint": "需要额外的 Cloudflare 明确授权。只读检查不会申请 D1 写入权限。",
    "d1Progress": "已完成 {applied} 项，还剩 {remaining} 项",
    "d1Complete": "D1 迁移已完成。Worker 激活需要单独执行。",
    "d1ContinueHint": "迁移中断后，请重新检查 D1 迁移记录再继续。",
    "stageTitle": "暂存 Worker 新版本",
    "stageDesc": "上传并验证 Nightly Worker，但暂不将任何流量切换过去。",
    "inspectVersion": "检查 Worker 版本",
    "authDeploy": "授权 Worker 写入与 D1",
    "nightlyCandidate": "官方 Nightly 候选版本",
    "inactive": "未激活",
    "activeVersion": "当前活动版本",
    "migrationTag": "DO 迁移标记",
    "bindingsPreserved": "保留已有绑定：{count} 个",
    "legacyApprove": "我已检查现有非托管 Worker，并同意接管，且不替换其 D1、KV、DO 或密钥。",
    "uploadInactive": "上传未激活版本",
    "uploading": "上传中…",
    "findPrevious": "找回之前暂存的版本",
    "previousCandidates": "已暂存版本",
    "useCandidate": "选择此版本",
    "stagedReady": "版本暂存完成 · 可继续检查",
    "stageSafety": "D1、KV、DO 和密钥保持不变。尚未启用新版本流量。",
    "stageRestoreEmpty": "没有兼容的暂存版本。请先上传 Nightly 候选版本。",
    "stageRestored": "已从 Cloudflare 版本历史找回兼容候选版本。",
    "stageContinueHint": "确认激活之前，当前 Worker 会继续正常服务。",
    "activateTitle": "确认并激活版本",
    "activateDesc": "最后一步：确认版本和数据库状态，再将 100% Worker 流量切换至新版本。",
    "activationTarget": "待激活版本",
    "activationNeedD1": "激活前需要检查对应 D1 数据库，并执行所有待处理 Nightly SQL。",
    "activate100": "将 100% 流量切换至新版本",
    "activationSuccess": "Worker 新版本已激活",
    "deploymentId": "部署 ID",
    "versionId": "版本 ID",
    "activationNote": "激活操作不会更新 Cloudflare 定时触发器或自定义路由。",
    "installUnavailable": "首次安装尚未开放",
    "installUnavailableHint": "全新安装所需的 D1、KV 等资源创建仍在开发中。已有实例可以使用升级流程。",
    "actionConfirmD1": "确定向 {target} 执行 {count} 个迁移吗？现有 Worker 将继续服务。",
    "actionConfirmStage": "将官方提交 {sha} 上传为未激活版本吗？已有绑定将被保留。",
    "actionConfirmActivate": "确认把版本 {version} 激活为 100% 流量吗？这将切换线上 Worker。",
    "activationNoCandidate": "激活前需要先暂存并选择候选版本。",
    "authFailed": "Cloudflare 授权失败：{error}",
    "unexpectedError": "发生未知错误",
    "httpError": "请求失败（HTTP {status}）",
    "invalidResponse": "API 响应无效",
    "requestFailed": "操作失败，请检查详情后重试。",
    "showTechnical": "技术详情",
    "stageFinish": "已完成升级",
    "stepBlocked": "请先完成当前步骤再继续。",
    "theme": "主题",
    "lightTheme": "亮色",
    "darkTheme": "暗色",
    "systemTheme": "跟随系统",
    "cancel": "取消",
    "confirm": "确认",
    "confirmStageTitle": "确认上传未激活 Worker 版本",
    "confirmD1Title": "确认执行 D1 迁移",
    "confirmActivateTitle": "确认激活 Worker 版本",
    "languageSelect": "语言",
    "confirmActionHint": "此操作需要单独确认，继续步骤并不会自动执行。",
    "sourceTitleShort": "InsightFlare 部署",
    "stateNotInstalled": "尚未安装",
    "stateMissingWorkerTag": "缺少 Worker 标记",
    "statePermissionRequired": "需要授权",
    "stateNotConfigured": "尚未配置",
    "stateRepositoryMismatch": "仓库不匹配",
    "stateUnsafeTrigger": "构建触发器存在风险",
    "stateCandidate": "待检查的候选配置",
    "apiPlan1": "重新验证 OAuth 账户及所有权",
    "apiPlan2": "确定并固定不可变的源码提交",
    "apiPlan3": "下载并校验固定 SHA 的官方 Nightly 包",
    "apiPlan4": "检查并执行仅向前的 D1 迁移",
    "apiPlan5": "检查资源绑定并上传 Worker 模块与静态资源",
    "apiPlan6": "保留原有密钥、域名路由和用户数据",
    "apiPlan7": "验证服务并记录已部署的 SHA",
    "apiBlocker1": "已有实例可以使用 D1 迁移和 Worker 版本升级；首次安装资源创建与一键部署仍未开放。",
    "apiBlocker2": "Worker 名称已被未知应用占用，禁止自动接管。",
    "apiBlocker3": "旧版实例必须先明确确认接管。",
    "apiBlocker4": "安装前必须先检查已有 Worker。",
    "apiBlocker5": "此账户尚未安装 InsightFlare。",
    "apiBlocker6": "修复需要已知的托管版本 SHA。",
    "apiIssue1": "无法验证 Worker 身份或部署标记，已阻止自动接管。",
    "apiIssue2": "已有 InsightFlare Worker 没有受管理的 SHA，需要确认接管。",
    "apiIssue3": "Cloudflare 未返回标准 Worker。首次安装前请检查授权是否允许列出 Worker。",
    "resourceCreate": "创建",
    "resourcePreserve": "保留",
    "resourceBlock": "阻止",
    "resourceOptional": "可选",
    "resourceUnknownOwnership": "需要先验证 Worker 所有权才能操作资源。",
    "resourceUnexpectedBinding": "该绑定类型、标识或名称异常，需要人工检查。",
    "resourceExistingRequired": "现有实例缺少必要绑定，禁止自动替换。",
    "resourceKeepSecret": "保留已有密钥元数据，不读取、不替换、不轮换其内容。",
    "resourceCreateD1": "创建独立 D1 数据库并应用已审核迁移。",
    "resourceKeepD1": "保留当前 D1 数据库 ID 和所有已有内容。",
    "resourceCreateKv": "为网站设置创建 KV 命名空间。",
    "resourceKeepKv": "保留当前 KV 命名空间和站点设置。",
    "resourceCreateDo": "通过已审核 Worker 迁移创建摄取 DO SQLite 命名空间。",
    "resourceKeepDo": "保留原有 Durable Object 命名空间与状态。",
    "resourceCreateSecret": "生成新的安全随机密钥，不向浏览器发送其内容。",
    "resourceKeepRootSecret": "保留已有密钥绑定，不读取或轮换密钥。",
    "requiredBindingMissing": "缺少必要绑定 {name}，无法安全更新。"
  }
};
const zh_twMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare 部署",
    "tagline": "你的分析系統，部署在自己的 Cloudflare 帳戶。",
    "wizard": "部署精靈",
    "wizardHelp": "逐步完成部署。確認啟用之前，現有 Worker 會繼續運作。",
    "language": "語言",
    "connected": "已連線",
    "disconnected": "未連線",
    "next": "繼續",
    "back": "上一步",
    "close": "關閉",
    "refresh": "重新整理",
    "viewCommit": "查看提交",
    "sourceGitHub": "在 GitHub 查看專案",
    "previous": "上一步",
    "stepCount": "第 {current} 步，共 {total} 步",
    "progress": "部署進度",
    "completed": "已完成",
    "current": "目前",
    "upcoming": "尚未開始",
    "needsAttention": "需要處理",
    "working": "處理中…",
    "loading": "載入中…",
    "unavailable": "無法使用",
    "unknown": "未知",
    "yes": "是",
    "no": "否",
    "available": "可用",
    "missing": "缺少",
    "ready": "就緒",
    "pending": "待處理",
    "dismiss": "關閉提示",
    "stepConnect": "連線",
    "stepAccount": "帳戶",
    "stepSource": "檢查",
    "stepD1": "資料庫",
    "stepStage": "暫存",
    "stepActivate": "啟用",
    "connectTitle": "連接 Cloudflare 帳戶",
    "connectDesc": "使用 Cloudflare 授權來探索既有的 InsightFlare 執行個體。額外權限只會在需要時請求。",
    "connectButton": "使用 Cloudflare 連線",
    "oauthMissing": "此服務尚未設定 OAuth。",
    "connectedDesc": "Cloudflare 工作階段已連線。請繼續選擇要管理的帳戶。",
    "disconnect": "中斷連線",
    "dataPromise": "分析資料始終保存在你自己的 Cloudflare 帳戶中。",
    "accountTitle": "選擇要管理的帳戶",
    "accountDesc": "直接從所選 Cloudflare 帳戶探索 InsightFlare Worker。",
    "accountLabel": "Cloudflare 帳戶",
    "accountPlaceholder": "選擇帳戶",
    "discovering": "正在檢查既有執行個體…",
    "noInstallation": "尚未安裝",
    "managed": "已受管理的執行個體",
    "legacy": "既有執行個體 · 須確認接管",
    "conflict": "Worker 名稱衝突",
    "worker": "Worker",
    "deployedSha": "目前部署的版本",
    "sourceTitle": "檢查官方 Nightly",
    "sourceDesc": "所有操作皆固定至官方 main 的最新提交。變更基礎設施前可先檢查計畫。",
    "sourceBranch": "原始碼分支",
    "sourceCommit": "官方提交",
    "sourceLoading": "正在取得最新提交…",
    "sourceMissing": "無法取得原始碼版本",
    "commitDate": "提交於 {date}",
    "buildTitle": "建置整合",
    "buildDesc": "Nightly 由 GitHub 官方工作流程建置，無須安裝 Docker 或自行編譯。",
    "repoVerified": "儲存庫識別",
    "planTitle": "檢查部署計畫",
    "planDesc": "這是唯讀預覽。準備執行記錄不會安裝或更新任何資源。",
    "operation": "操作類型",
    "install": "從 main 安裝",
    "update": "更新至 main",
    "repair": "修復目前版本",
    "previewPlan": "預覽計畫",
    "freezeSha": "固定已檢查的 SHA",
    "planSteps": "計畫步驟",
    "planBlockers": "計畫限制",
    "noPlan": "選擇帳戶後即可預覽部署計畫。",
    "resourceActions": "資源核對",
    "resourceBlockers": "{count} 項資源限制",
    "prepared": "已準備操作 · 尚未部署",
    "preparedUntil": "固定的 SHA 將於 {time} 到期",
    "preparedHint": "準備操作不會修改 Cloudflare 資源。",
    "d1Title": "檢查 D1 資料庫遷移",
    "d1Desc": "先檢查官方 SQL 檔案，再單獨執行待處理遷移。既有 Worker 持續運作。",
    "d1Label": "D1 資料庫",
    "d1Placeholder": "選擇資料庫",
    "inspectMigrations": "檢查遷移",
    "verifyD1": "正在驗證 Nightly 與 D1…",
    "schemaCurrent": "資料庫結構已是最新",
    "migrationApplied": "已套用",
    "migrationPending": "待執行",
    "migrationTotal": "官方 SQL 檔案",
    "recoveryPoint": "復原書籤",
    "migrationRisk": "部分遷移會更動既有結構或資料。請先確認相容性；舊 Worker 不會停止服務。",
    "migrationReview": "檢查",
    "migrationAdd": "新增",
    "applyMigrations": "執行待處理 D1 遷移",
    "applyingMigrations": "正在執行遷移…",
    "authD1Read": "授權 D1 讀取",
    "authD1Write": "授權 D1 寫入",
    "d1ScopeHint": "須取得額外的 Cloudflare 明確授權。唯讀檢查不會要求 D1 寫入權限。",
    "d1Progress": "已完成 {applied} 項，剩餘 {remaining} 項",
    "d1Complete": "D1 遷移已完成。Worker 啟用須另外執行。",
    "d1ContinueHint": "遷移中斷後，請重新檢查 D1 遷移記錄再繼續。",
    "stageTitle": "暫存新版 Worker",
    "stageDesc": "上傳並驗證 Nightly Worker，但暫不將任何流量切換過去。",
    "inspectVersion": "檢查 Worker 版本",
    "authDeploy": "授權 Worker 寫入與 D1",
    "nightlyCandidate": "官方 Nightly 候選版本",
    "inactive": "尚未啟用",
    "activeVersion": "目前使用中的版本",
    "migrationTag": "DO 遷移標記",
    "bindingsPreserved": "保留既有綁定：{count} 個",
    "legacyApprove": "我已檢查既有未受管理的 Worker，並同意接管且不取代其 D1、KV、DO 或密鑰。",
    "uploadInactive": "上傳未啟用版本",
    "uploading": "上傳中…",
    "findPrevious": "找回先前暫存的版本",
    "previousCandidates": "已暫存版本",
    "useCandidate": "選擇此版本",
    "stagedReady": "版本暫存完成 · 可繼續檢查",
    "stageSafety": "D1、KV、DO 和密鑰維持不變。尚未導入新版流量。",
    "stageRestoreEmpty": "找不到相容的暫存版本。請先上傳 Nightly 候選版本。",
    "stageRestored": "已從 Cloudflare 版本歷史找回相容候選版本。",
    "stageContinueHint": "確認啟用之前，目前 Worker 將繼續正常服務。",
    "activateTitle": "確認並啟用版本",
    "activateDesc": "最後一步：確認版本及資料庫狀態，再將 100% Worker 流量切換至新版。",
    "activationTarget": "待啟用版本",
    "activationNeedD1": "啟用前須檢查對應 D1 資料庫，並完成所有待處理 Nightly SQL。",
    "activate100": "將 100% 流量切換至新版",
    "activationSuccess": "新版 Worker 已啟用",
    "deploymentId": "部署 ID",
    "versionId": "版本 ID",
    "activationNote": "啟用操作不會更新 Cloudflare 排程觸發器或自訂路由。",
    "installUnavailable": "首次安裝尚未開放",
    "installUnavailableHint": "新安裝所需的 D1、KV 等資源建立仍在開發中。既有執行個體可使用更新流程。",
    "actionConfirmD1": "確定要對 {target} 執行 {count} 項遷移嗎？既有 Worker 將繼續服務。",
    "actionConfirmStage": "要將官方提交 {sha} 上傳為未啟用版本嗎？既有綁定將保留。",
    "actionConfirmActivate": "確定要將版本 {version} 啟用並切換 100% 流量嗎？此操作將切換線上 Worker。",
    "activationNoCandidate": "啟用前須先暫存並選擇候選版本。",
    "authFailed": "Cloudflare 授權失敗：{error}",
    "unexpectedError": "發生未知錯誤",
    "httpError": "請求失敗（HTTP {status}）",
    "invalidResponse": "API 回應無效",
    "requestFailed": "操作失敗，請檢查詳情後重試。",
    "showTechnical": "技術詳情",
    "stageFinish": "已完成更新",
    "stepBlocked": "請先完成目前步驟再繼續。",
    "theme": "主題",
    "lightTheme": "淺色",
    "darkTheme": "深色",
    "systemTheme": "跟隨系統",
    "cancel": "取消",
    "confirm": "確認",
    "confirmStageTitle": "確認上傳未啟用的 Worker 版本",
    "confirmD1Title": "確認執行 D1 遷移",
    "confirmActivateTitle": "確認啟用 Worker 版本",
    "languageSelect": "語言",
    "confirmActionHint": "此操作需要另外確認，切換步驟不會自動執行。",
    "sourceTitleShort": "InsightFlare 部署",
    "stateNotInstalled": "尚未安裝",
    "stateMissingWorkerTag": "缺少 Worker 標記",
    "statePermissionRequired": "需要授權",
    "stateNotConfigured": "尚未設定",
    "stateRepositoryMismatch": "儲存庫不相符",
    "stateUnsafeTrigger": "建置觸發器有風險",
    "stateCandidate": "待檢查的候選設定",
    "apiPlan1": "重新驗證 OAuth 帳戶及所有權",
    "apiPlan2": "確定並固定不可變的原始碼提交",
    "apiPlan3": "下載並驗證固定 SHA 的官方 Nightly 壓縮檔",
    "apiPlan4": "檢查並執行僅向前的 D1 遷移",
    "apiPlan5": "檢查資源繫結並上傳 Worker 模組與靜態資源",
    "apiPlan6": "保留原有密鑰、網域路由與使用者資料",
    "apiPlan7": "驗證服務並記錄已部署的 SHA",
    "apiBlocker1": "既有執行個體可使用 D1 遷移及 Worker 版本升級；首次安裝資源建立與一鍵部署尚未開放。",
    "apiBlocker2": "Worker 名稱已被未知應用占用，禁止自動接管。",
    "apiBlocker3": "舊版執行個體須先明確確認接管。",
    "apiBlocker4": "安裝前須先檢查既有 Worker。",
    "apiBlocker5": "此帳戶尚未安裝 InsightFlare。",
    "apiBlocker6": "修復需要已知的受管理部署 SHA。",
    "apiIssue1": "無法驗證 Worker 身分或部署標記，已阻止自動接管。",
    "apiIssue2": "既有 InsightFlare Worker 沒有受管理的 SHA，需要確認接管。",
    "apiIssue3": "Cloudflare 未回傳標準 Worker。首次安裝前請檢查授權是否能列出 Worker。",
    "resourceCreate": "建立",
    "resourcePreserve": "保留",
    "resourceBlock": "阻止",
    "resourceOptional": "可選",
    "resourceUnknownOwnership": "須先驗證 Worker 所有權才能操作資源。",
    "resourceUnexpectedBinding": "該繫結類型、識別碼或名稱異常，須人工檢查。",
    "resourceExistingRequired": "既有執行個體缺少必要繫結，禁止自動取代。",
    "resourceKeepSecret": "保留既有密鑰中繼資料，不讀取、不取代、不輪替內容。",
    "resourceCreateD1": "建立獨立 D1 資料庫並套用已審核遷移。",
    "resourceKeepD1": "保留目前 D1 資料庫 ID 與所有既有內容。",
    "resourceCreateKv": "為網站設定建立 KV 命名空間。",
    "resourceKeepKv": "保留目前 KV 命名空間及網站設定。",
    "resourceCreateDo": "透過已審核 Worker 遷移建立攝取 DO SQLite 命名空間。",
    "resourceKeepDo": "保留原有 Durable Object 命名空間與狀態。",
    "resourceCreateSecret": "產生新的安全隨機密鑰，不向瀏覽器傳送內容。",
    "resourceKeepRootSecret": "保留既有密鑰繫結，不讀取或輪替密鑰。",
    "requiredBindingMissing": "缺少必要繫結 {name}，無法安全更新。"
  }
};
const jaMessages: AppMessages = {
  "deploy": {
    "brand": "InsightFlare Deploy",
    "tagline": "あなたの分析環境を、あなたの Cloudflare アカウントに。",
    "wizard": "デプロイアシスタント",
    "wizardHelp": "手順に従って進めます。有効化を承認するまで既存の Worker は稼働し続けます。",
    "language": "言語",
    "connected": "接続済み",
    "disconnected": "未接続",
    "next": "続ける",
    "back": "戻る",
    "close": "閉じる",
    "refresh": "更新",
    "viewCommit": "コミットを見る",
    "sourceGitHub": "GitHub でプロジェクトを見る",
    "previous": "前のステップ",
    "stepCount": "{total} ステップ中 {current}",
    "progress": "設定の進捗",
    "completed": "完了",
    "current": "現在",
    "upcoming": "未開始",
    "needsAttention": "要対応",
    "working": "処理中…",
    "loading": "読み込み中…",
    "unavailable": "利用不可",
    "unknown": "不明",
    "yes": "はい",
    "no": "いいえ",
    "available": "利用可能",
    "missing": "なし",
    "ready": "準備完了",
    "pending": "保留中",
    "dismiss": "閉じる",
    "stepConnect": "接続",
    "stepAccount": "アカウント",
    "stepSource": "確認",
    "stepD1": "データベース",
    "stepStage": "ステージング",
    "stepActivate": "有効化",
    "connectTitle": "Cloudflare アカウントに接続",
    "connectDesc": "Cloudflare で認証し、既存の InsightFlare を検出します。追加権限は必要なときだけ要求します。",
    "connectButton": "Cloudflare に接続",
    "oauthMissing": "このサービスの OAuth が設定されていません。",
    "connectedDesc": "Cloudflare に接続しました。管理するアカウントを選択してください。",
    "disconnect": "接続解除",
    "dataPromise": "分析データは Cloudflare アカウント内に保持されます。",
    "accountTitle": "管理するアカウントを選択",
    "accountDesc": "選択した Cloudflare アカウントから InsightFlare Worker を検出します。",
    "accountLabel": "Cloudflare アカウント",
    "accountPlaceholder": "アカウントを選択",
    "discovering": "既存のインストールを検出中…",
    "noInstallation": "未インストール",
    "managed": "管理対象インストール",
    "legacy": "既存インスタンス・承認が必要",
    "conflict": "Worker 名が競合",
    "worker": "Worker",
    "deployedSha": "デプロイ済みのソース",
    "sourceTitle": "公式 Nightly を確認",
    "sourceDesc": "すべての操作は公式 main の最新コミットに固定されます。変更前にプランを確認できます。",
    "sourceBranch": "ソースブランチ",
    "sourceCommit": "公式コミット",
    "sourceLoading": "最新コミットを取得中…",
    "sourceMissing": "ソースコミットを取得できません",
    "commitDate": "コミット日時：{date}",
    "buildTitle": "ビルド連携",
    "buildDesc": "公式 Nightly は GitHub でビルドされます。Docker やローカルビルドは不要です。",
    "repoVerified": "リポジトリ認証",
    "planTitle": "デプロイ計画を確認",
    "planDesc": "読み取り専用のプレビューです。準備だけでは何も変更されません。",
    "operation": "操作",
    "install": "main からインストール",
    "update": "main に更新",
    "repair": "現在のコミットを修復",
    "previewPlan": "プランを確認",
    "freezeSha": "確認済み SHA を固定",
    "planSteps": "予定される手順",
    "planBlockers": "計画の制限",
    "noPlan": "アカウントを選択すると計画を確認できます。",
    "resourceActions": "リソースの照合",
    "resourceBlockers": "リソース制限：{count} 件",
    "prepared": "操作を準備済み・未デプロイ",
    "preparedUntil": "固定 SHA の期限：{time}",
    "preparedHint": "準備では Cloudflare リソースを変更しません。",
    "d1Title": "D1 マイグレーションを確認",
    "d1Desc": "公式 SQL を確認し、未適用分を個別に実行します。既存 Worker は稼働を続けます。",
    "d1Label": "D1 データベース",
    "d1Placeholder": "データベースを選択",
    "inspectMigrations": "マイグレーションを確認",
    "verifyD1": "Nightly と D1 を検証中…",
    "schemaCurrent": "スキーマは最新です",
    "migrationApplied": "適用済み",
    "migrationPending": "未適用",
    "migrationTotal": "公式 SQL ファイル",
    "recoveryPoint": "復旧ブックマーク",
    "migrationRisk": "一部の移行は既存スキーマやデータを変更します。既存 Worker は稼働を続けるため、互換性を確認してください。",
    "migrationReview": "要確認",
    "migrationAdd": "追加",
    "applyMigrations": "未適用 D1 マイグレーションを実行",
    "applyingMigrations": "マイグレーションを実行中…",
    "authD1Read": "D1 読み取りを許可",
    "authD1Write": "D1 書き込みを許可",
    "d1ScopeHint": "追加の Cloudflare 同意が必要です。読み取り確認では D1 書き込み権限を要求しません。",
    "d1Progress": "{applied} 件適用、残り {remaining} 件",
    "d1Complete": "D1 マイグレーションは完了しました。Worker の有効化は別の操作です。",
    "d1ContinueHint": "移行が中断した場合は、再開前に D1 の履歴を再確認してください。",
    "stageTitle": "Worker の新バージョンをステージング",
    "stageDesc": "Nightly Worker をアップロードして検証しますが、トラフィックはまだ切り替えません。",
    "inspectVersion": "Worker バージョンを確認",
    "authDeploy": "Workers 書き込みと D1 を許可",
    "nightlyCandidate": "公式 Nightly 候補",
    "inactive": "未有効化",
    "activeVersion": "現在の有効バージョン",
    "migrationTag": "DO マイグレーションタグ",
    "bindingsPreserved": "既存バインディングの保持：{count} 件",
    "legacyApprove": "既存の非管理 Worker を確認し、D1、KV、DO、Secrets を置換せずに管理対象にすることを承認します。",
    "uploadInactive": "非アクティブ版をアップロード",
    "uploading": "アップロード中…",
    "findPrevious": "以前のアップロードを検索",
    "previousCandidates": "ステージング済みバージョン",
    "useCandidate": "このバージョンを選択",
    "stagedReady": "ステージング完了・確認可能",
    "stageSafety": "D1、KV、DO、Secrets は保持されます。新バージョンへのトラフィックはありません。",
    "stageRestoreEmpty": "互換性のある候補がありません。Nightly を先にアップロードしてください。",
    "stageRestored": "Cloudflare のバージョン履歴から候補を復元しました。",
    "stageContinueHint": "明示的に有効化するまで、既存 Worker が稼働します。",
    "activateTitle": "確認して有効化",
    "activateDesc": "最後の確認です。バージョンと DB を確認してから、トラフィックを 100% 切り替えます。",
    "activationTarget": "有効化するバージョン",
    "activationNeedD1": "有効化の前に対象 D1 を確認し、Nightly SQL の未適用分を完了してください。",
    "activate100": "トラフィックを 100% 切り替えて有効化",
    "activationSuccess": "Worker の新バージョンが有効になりました",
    "deploymentId": "デプロイ ID",
    "versionId": "バージョン ID",
    "activationNote": "有効化しても Cloudflare の Cron トリガーやカスタムルートは更新されません。",
    "installUnavailable": "新規インストールはまだ利用できません",
    "installUnavailableHint": "新規の D1、KV などの自動作成は開発中です。既存インスタンスはアップグレードできます。",
    "actionConfirmD1": "{target} に {count} 件の移行を実行しますか？既存 Worker は稼働を続けます。",
    "actionConfirmStage": "公式ソース {sha} を非アクティブ版としてアップロードしますか？既存バインディングは保持されます。",
    "actionConfirmActivate": "バージョン {version} にトラフィックを 100% 切り替えますか？稼働中の Worker が変更されます。",
    "activationNoCandidate": "有効化にはステージング済みの候補が必要です。",
    "authFailed": "Cloudflare の認証に失敗：{error}",
    "unexpectedError": "予期しないエラー",
    "httpError": "リクエスト失敗（HTTP {status}）",
    "invalidResponse": "API レスポンスが無効です",
    "requestFailed": "操作に失敗しました。詳細を確認して再試行してください。",
    "showTechnical": "技術的な詳細",
    "stageFinish": "アップデート完了",
    "stepBlocked": "現在のステップを完了してから続けてください。",
    "theme": "テーマ",
    "lightTheme": "ライト",
    "darkTheme": "ダーク",
    "systemTheme": "システム",
    "cancel": "キャンセル",
    "confirm": "確認",
    "confirmStageTitle": "Worker の非アクティブ版をアップロード",
    "confirmD1Title": "D1 マイグレーションを確認",
    "confirmActivateTitle": "Worker バージョンの有効化を確認",
    "languageSelect": "言語",
    "confirmActionHint": "この操作には個別の承認が必要です。次のステップに進むだけでは実行されません。",
    "sourceTitleShort": "InsightFlare Deploy",
    "stateNotInstalled": "未インストール",
    "stateMissingWorkerTag": "Worker タグなし",
    "statePermissionRequired": "権限が必要",
    "stateNotConfigured": "未設定",
    "stateRepositoryMismatch": "リポジトリが不一致",
    "stateUnsafeTrigger": "危険なビルドトリガー",
    "stateCandidate": "候補の設定",
    "apiPlan1": "OAuth アカウントと所有権を再確認",
    "apiPlan2": "不変のソースコミットを特定して固定",
    "apiPlan3": "SHA 固定の公式 Nightly をダウンロードして検証",
    "apiPlan4": "前進のみの D1 マイグレーションを確認・適用",
    "apiPlan5": "リソースを照合して Worker モジュールとアセットをアップロード",
    "apiPlan6": "既存のシークレット、ドメインルート、ユーザーデータを保持",
    "apiPlan7": "稼働状態を確認しデプロイ SHA を記録",
    "apiBlocker1": "既存インスタンスは D1 移行と Worker 更新が利用できます。新規インストールと一括デプロイは未対応です。",
    "apiBlocker2": "Worker 名は不明なアプリが使用しており、自動引き継ぎは禁止です。",
    "apiBlocker3": "旧インスタンスには明示的な引き継ぎ承認が必要です。",
    "apiBlocker4": "インストール前に既存 Worker の確認が必要です。",
    "apiBlocker5": "このアカウントには InsightFlare がインストールされていません。",
    "apiBlocker6": "修復には管理対象デプロイの SHA が必要です。",
    "apiIssue1": "Worker の識別情報を確認できず、自動引き継ぎを拒否しました。",
    "apiIssue2": "既存 Worker に管理 SHA がなく、引き継ぎ手続きが必要です。",
    "apiIssue3": "Cloudflare から標準 Worker が見つかりません。権限を確認してください。",
    "resourceCreate": "作成",
    "resourcePreserve": "保持",
    "resourceBlock": "ブロック",
    "resourceOptional": "任意",
    "resourceUnknownOwnership": "リソース操作前に Worker の所有権を確認してください。",
    "resourceUnexpectedBinding": "バインディングの型・ID・名前に異常があり、手動確認が必要です。",
    "resourceExistingRequired": "必須バインディングがありません。自動置換は禁止です。",
    "resourceKeepSecret": "既存シークレットの値を読み取らず、置換・ローテーションせずに保持します。",
    "resourceCreateD1": "独立 D1 データベースを作成し、確認済みマイグレーションを適用します。",
    "resourceKeepD1": "この D1 データベース ID と既存データを保持します。",
    "resourceCreateKv": "サイト設定用 KV 名前空間を作成します。",
    "resourceKeepKv": "この KV 名前空間とサイト設定を保持します。",
    "resourceCreateDo": "承認済み Worker 移行を使って IngestDurableObject SQLite を作成します。",
    "resourceKeepDo": "既存 Durable Object 名前空間と状態を保持します。",
    "resourceCreateSecret": "安全な乱数でシークレットを生成し、ブラウザには送信しません。",
    "resourceKeepRootSecret": "シークレットを読み取らず、ローテーションせずに保持します。",
    "requiredBindingMissing": "必須バインディング {name} がないため、安全に更新できません。"
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
