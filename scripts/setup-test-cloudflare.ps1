# Securely store a TEST account user-scoped Cloudflare API token using Windows DPAPI.
# Usage: pwsh -NoProfile -File .\scripts\setup-test-cloudflare.ps1
# Never commit or send the token through chat.
[CmdletBinding()]
param([ValidatePattern('^[a-fA-F0-9]{32}$')][string]$AccountId)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
  throw 'This helper requires Windows DPAPI.'
}
if (-not $AccountId) {
  $AccountId = (Read-Host 'Cloudflare 测试账户的 Account ID（32 位十六进制）').Trim()
}
if ($AccountId -notmatch '^[a-fA-F0-9]{32}$') { throw 'Account ID 格式无效。' }
$AccountId = $AccountId.ToLowerInvariant()
Write-Host '请直接在 ASUS 终端中输入测试账户专用的 User API Token。输入过程不会回显。'
$secure = Read-Host 'Cloudflare API Token' -AsSecureString
if ($secure.Length -lt 12) { throw 'Token 为空或太短。' }
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = ''
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $url = 'https://api.cloudflare.com/client/v4/accounts/' + $AccountId + '/workers/scripts'
  $response = Invoke-RestMethod -Method Get -Uri $url -Headers @{Authorization='Bearer '+$token} -TimeoutSec 20
  if (-not $response.success) { throw 'Cloudflare API 拒绝该测试账户的 Worker 只读请求。' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $token = $null
}
$directory = Join-Path $env:LOCALAPPDATA 'InsightFlareDeploy'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
# ConvertFrom-SecureString uses the current Windows user's DPAPI keys.
$encrypted = ConvertFrom-SecureString -SecureString $secure
$tokenFile = Join-Path $directory 'cloudflare-test-token.dpapi'
$accountFile = Join-Path $directory 'cloudflare-test-account.txt'
[System.IO.File]::WriteAllText($tokenFile, $encrypted, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($accountFile, $AccountId, [System.Text.UTF8Encoding]::new($false))
Write-Host '已验证测试账户的 Worker 只读权限，Token 已通过 Windows DPAPI 加密保存在当前用户本地。'
Write-Host '没有写入 E:\deploy、Git 仓库或聊天消息。'
