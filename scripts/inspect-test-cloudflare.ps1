# Read-only inspection of the explicitly configured Cloudflare test account.
# This helper never prints the token, performs no writes and does not touch other accounts.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'InsightFlareDeploy'
$tokenFile = Join-Path $directory 'cloudflare-test-token.dpapi'
$accountFile = Join-Path $directory 'cloudflare-test-account.txt'
if (-not (Test-Path $tokenFile) -or -not (Test-Path $accountFile)) {
  throw '未配置测试账户；请先执行 scripts/setup-test-cloudflare.ps1。'
}
$accountId = [System.IO.File]::ReadAllText($accountFile).Trim()
if ($accountId -notmatch '^[a-f0-9]{32}$') { throw '测试账户 ID 文件无效。' }
$secure = ConvertTo-SecureString ([System.IO.File]::ReadAllText($tokenFile))
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = ''
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $headers = @{ Authorization='Bearer '+$token }
  function Read-Resource([string]$suffix) {
    $uri = 'https://api.cloudflare.com/client/v4/accounts/' + $accountId + $suffix
    $response = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 20
    if (-not $response.success) { throw 'Cloudflare 读取失败：' + $suffix }
    return $response
  }
  $workers = Read-Resource '/workers/scripts'
  $names = @($workers.result | Where-Object { $_ -and $_.id } | ForEach-Object { $_.id })
  Write-Output ('测试账户 Worker 数量：' + $names.Count)
  $matches = @($names | Where-Object { $_ -match '(?i)insightflare' })
  if ($matches.Count -eq 0) {
    Write-Output '未发现名称中包含 insightflare 的 Worker。'
  } else {
    foreach ($name in $matches) { Write-Output ('InsightFlare 测试实例候选：' + $name) }
  }
  # Additional resources may require separate permissions. Do not fail the whole
  # inspection if the initial read-only token does not grant these.
  foreach ($type in @(
    @{ label='D1'; path='/d1/database?per_page=100'; field='name' },
    @{ label='KV'; path='/storage/kv/namespaces?per_page=100'; field='title' }
  )) {
    try {
      $res = Read-Resource $type.path
      $all = @($res.result)
      Write-Output ($type.label + ' 资源数量：' + $all.Count)
      foreach ($item in $all | Where-Object { $_.($type.field) -match '(?i)insightflare' }) {
        Write-Output ($type.label + ' 相关资源：' + $item.($type.field))
      }
    } catch {
      Write-Output ($type.label + ' 当前 Token 权限不足或暂不可用（不影响 Worker 只读检查）。')
    }
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $token = $null
}
