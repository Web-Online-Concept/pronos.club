$headers = @{ "x-admin-email" = "flotoulouse7@gmail.com" }
Write-Host "Lancement cron generate v2 manuel..." -ForegroundColor Cyan
$startedAt = Get-Date
try {
    $r = Invoke-WebRequest -Uri "https://www.pronos.club/api/cron/ai-picks-generate" -Headers $headers -UseBasicParsing -TimeoutSec 250
    $elapsed = (Get-Date) - $startedAt
    Write-Host "STATUS:" $r.StatusCode "| Duration: $([Math]::Round($elapsed.TotalSeconds, 1))s"
    Write-Host ""
    $r.Content
} catch {
    Write-Host "ERROR:" $_.Exception.Message
}
