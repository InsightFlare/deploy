# Review or apply pending migrations ONLY on the isolated restored D1 clone.
# Usage: pwsh -File .\scripts\run-test-d1-migrations.ps1 -SourceCheckout E:\ifd-source-validation
#        pwsh -File .\scripts\run-test-d1-migrations.ps1 -SourceCheckout E:\ifd-source-validation -Apply
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SourceCheckout,
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'InsightFlareDeploy'
$accountId = [IO.File]::ReadAllText((Join-Path $root 'cloudflare-test-account.txt')).Trim()
$clone = [IO.File]::ReadAllText((Join-Path $root 'test-d1-clone.json')) | ConvertFrom-Json
if ($accountId -notmatch '^[a-f0-9]{32}$' -or $clone.accountId -ne $accountId) { throw '克隆数据库与测试账户不匹配' }
if ($clone.name -notmatch '^insightflare-migration-validation-\d{8}-\d{6}$' -or $clone.uuid -notmatch '^[0-9a-f-]{36}$') {
  throw '不是预期的隔离迁移副本'
}
$source = (Resolve-Path $SourceCheckout).Path
if (-not (Test-Path (Join-Path $source 'migrations'))) { throw '上游迁移目录不存在' }
$secure = ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $root 'cloudflare-test-token.dpapi')))
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  foreach ($key in @('CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL')) {
    Remove-Item ('Env:' + $key) -ErrorAction SilentlyContinue
  }
  $env:CLOUDFLARE_API_TOKEN = $token
  $env:CLOUDFLARE_ACCOUNT_ID = $accountId
  $env:CI = 'true'
  # Use a dedicated config that contains ONLY the clone DB. Never pass the
  # actual application's wrangler.toml, so production D1 cannot be targeted.
  $config = Join-Path $root 'wrangler.clone.toml'
  $migrations = (Join-Path $source 'migrations').Replace('\', '/')
  $toml = @(
    'name = "insightflare-migration-validation-only"'
    'compatibility_date = "2026-11-01"'
    '[[d1_databases]]'
    'binding = "DB"'
    ('database_name = "' + $clone.name + '"')
    ('database_id = "' + $clone.uuid + '"')
    ('migrations_dir = "' + $migrations + '"')
  ) -join "`n"
  [IO.File]::WriteAllText($config, $toml + "`n", [Text.UTF8Encoding]::new($false))
  if ($Apply) { Write-Output ('APPLY_TO_ISOLATED_CLONE ' + $clone.name) }
  else { Write-Output ('READ_ONLY_PENDING_MIGRATIONS ' + $clone.name) }
  $args = @('exec','wrangler','d1','migrations', $(if ($Apply) { 'apply' } else { 'list' }), 'DB','--remote','--config',$config)
  & pnpm @args
  if ($LASTEXITCODE -ne 0) { throw ('Wrangler D1 migration command failed, exit=' + $LASTEXITCODE) }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
  Remove-Variable token -ErrorAction SilentlyContinue
}
