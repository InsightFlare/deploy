# Read-only migration inventory for the explicitly saved Cloudflare test account.
# Does not read rows from user/business tables or print API credentials.
$ErrorActionPreference = 'Stop'
$folder = Join-Path $env:LOCALAPPDATA 'InsightFlareDeploy'
$account = [IO.File]::ReadAllText((Join-Path $folder 'cloudflare-test-account.txt')).Trim()
if ($account -notmatch '^[a-f0-9]{32}$') { throw '测试账户 ID 无效' }
$secure = ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $folder 'cloudflare-test-token.dpapi')))
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $headers = @{ Authorization = 'Bearer ' + $token }
  $root = 'https://api.cloudflare.com/client/v4/accounts/' + $account
  $databases = Invoke-RestMethod -Uri ($root + '/d1/database?per_page=100') -Headers $headers -TimeoutSec 22
  $matches = @($databases.result | Where-Object { $_.name -eq 'insightflare' })
  if ($matches.Count -ne 1) { throw '该账户没有唯一的 InsightFlare D1 数据库' }
  $query = $root + '/d1/database/' + $matches[0].uuid + '/query'
  foreach ($sql in @(
    'PRAGMA table_info(d1_migrations)',
    'SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 20',
    'SELECT count(*) AS count FROM d1_migrations'
  )) {
    $body = @{ sql = $sql } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri $query -Method Post -Body $body -ContentType 'application/json' -Headers $headers -TimeoutSec 25
    if (-not $response.success) { throw 'D1 查询失败' }
    Write-Output ('QUERY ' + $sql)
    foreach ($segment in @($response.result)) {
      foreach ($row in @($segment.results)) {
        if ($sql -like 'PRAGMA*') {
          Write-Output ('COLUMN ' + $row.name + ' TYPE=' + $row.type)
        } elseif ($sql -like '*count(*)*') {
          Write-Output ('MIGRATION_COUNT ' + $row.count)
        } else {
          Write-Output ('APPLIED ' + $row.name)
        }
      }
    }
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable token -ErrorAction SilentlyContinue
}
