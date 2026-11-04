# Restores a DPAPI-encrypted SQL export into a NEW, isolated Cloudflare D1
# database in the previously configured test account. NEVER touches the source D1.
[CmdletBinding()]
param([string]$BackupPath)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'InsightFlareDeploy'
$account = [IO.File]::ReadAllText((Join-Path $root 'cloudflare-test-account.txt')).Trim()
if ($account -notmatch '^[a-f0-9]{32}$') { throw '测试账户 ID 无效' }
if (-not $BackupPath) {
  $latest = Get-ChildItem (Join-Path $root 'backups') -Filter 'insightflare-d1-*.sql.dpapi' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw '未找到 D1 加密备份' }
  $BackupPath = $latest.FullName
}
if (-not (Test-Path -LiteralPath $BackupPath)) { throw '备份文件不存在' }
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$entropy = [Text.Encoding]::UTF8.GetBytes('InsightFlareDeploy-Test-D1-Backup-v1')
$encrypted = [IO.File]::ReadAllBytes($BackupPath)
$plain = [Security.Cryptography.ProtectedData]::Unprotect(
  $encrypted, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
)
if ($plain.Length -lt 1024) { throw '解密后备份数据异常' }
$etag = [Convert]::ToHexString([Security.Cryptography.MD5]::HashData($plain)).ToLowerInvariant()
$secure = ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $root 'cloudflare-test-token.dpapi')))
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$cloneName = 'insightflare-migration-validation-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$cloneId = ''
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $headers = @{ Authorization = 'Bearer ' + $token }
  $base = 'https://api.cloudflare.com/client/v4/accounts/' + $account
  $existing = Invoke-RestMethod -Uri ($base + '/d1/database?per_page=100') -Headers $headers -TimeoutSec 25
  if (-not $existing.success -or @($existing.result | Where-Object { $_.name -eq 'insightflare' }).Count -ne 1) {
    throw '测试账户或原始 D1 身份检查失败'
  }
  Write-Output ('BACKUP_VERIFIED_BYTES=' + $plain.Length)
  $created = Invoke-RestMethod -Uri ($base + '/d1/database') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ name = $cloneName } | ConvertTo-Json -Compress) -TimeoutSec 30
  if (-not $created.success -or $created.result.name -ne $cloneName) { throw '创建隔离 D1 副本失败' }
  $cloneId = $created.result.uuid
  Write-Output ('ISOLATED_CLONE_CREATED=' + $cloneName + ' UUID=' + $cloneId)
  $importUrl = $base + '/d1/database/' + $cloneId + '/import'
  $init = Invoke-RestMethod -Uri $importUrl -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ action='init';etag=$etag } | ConvertTo-Json -Compress) -TimeoutSec 40
  if (-not $init.success -or -not $init.result.upload_url -or -not $init.result.filename) { throw '无法初始化副本 SQL 上传' }
  $http = [Net.Http.HttpClient]::new()
  try {
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Put, $init.result.upload_url)
    $request.Content = [Net.Http.ByteArrayContent]::new($plain)
    $uploaded = $http.SendAsync($request).GetAwaiter().GetResult()
    if (-not $uploaded.IsSuccessStatusCode) { throw ('SQL 上传失败 HTTP ' + [int]$uploaded.StatusCode) }
  } finally {
    $request.Dispose()
    $http.Dispose()
  }
  Write-Output 'SQL_UPLOADED_TO_ISOLATED_CLONE'
  $ingest = Invoke-RestMethod -Uri $importUrl -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ action='ingest';etag=$etag;filename=$init.result.filename } | ConvertTo-Json -Compress) -TimeoutSec 60
  if (-not $ingest.success) { throw 'D1 拒绝执行副本导入' }
  $phase = $ingest.result.status
  $bookmark = $ingest.result.at_bookmark
  for ($attempt=0; $attempt -lt 95 -and $phase -ne 'complete'; $attempt++) {
    if ($phase -eq 'error') { throw ('副本导入失败：' + $ingest.result.error) }
    if (-not $bookmark) { throw 'D1 导入未返回可轮询的 bookmark' }
    Start-Sleep -Seconds 2
    $ingest = Invoke-RestMethod -Uri $importUrl -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ action='poll';current_bookmark=$bookmark } | ConvertTo-Json -Compress) -TimeoutSec 35
    if (-not $ingest.success) { throw 'D1 导入轮询请求失败' }
    $phase = $ingest.result.status
    $bookmark = $ingest.result.at_bookmark
  }
  if ($phase -ne 'complete') { throw '副本导入超过安全轮询上限' }
  Write-Output ('CLONE_IMPORT_COMPLETE=' + $cloneName)
  $queryResponse = Invoke-RestMethod -Uri ($base + '/d1/database/' + $cloneId + '/query') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ sql = 'SELECT count(*) AS total FROM d1_migrations' } | ConvertTo-Json -Compress) -TimeoutSec 25
  if (-not $queryResponse.success) { throw '副本迁移表验证失败' }
  $count = $queryResponse.result[0].results[0].total
  Write-Output ('CLONE_APPLIED_MIGRATIONS=' + $count)
  $resultPath = Join-Path $root 'test-d1-clone.json'
  [IO.File]::WriteAllText($resultPath, (@{ accountId=$account; name=$cloneName; uuid=$cloneId; originBackup=[IO.Path]::GetFileName($BackupPath); createdAt=[DateTimeOffset]::UtcNow.ToString('o') } | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  Write-Output ('CLONE_METADATA=' + $resultPath)
} catch {
  Write-Output ('CLONE_VALIDATION_FAILED_STAGE=' + $_.Exception.Message.Split([Environment]::NewLine)[0])
  if ($cloneId) { Write-Output ('CLONE_LEFT_IN_TEST_ACCOUNT=' + $cloneName + ' UUID=' + $cloneId) }
  throw
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  [Array]::Clear($plain, 0, $plain.Length)
  Remove-Variable token -ErrorAction SilentlyContinue
}
