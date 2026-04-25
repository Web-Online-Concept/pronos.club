$headers = @{ "x-admin-email" = "flotoulouse7@gmail.com" }
try {
    $r = Invoke-WebRequest -Uri "https://www.pronos.club/api/debug/ai-consensus-test?mode=consensus" -Headers $headers -UseBasicParsing -TimeoutSec 180
    $content = $r.Content
    Write-Host "STATUS:" $r.StatusCode "| LENGTH:" $r.Content.Length
    Write-Host ""
    if ($content -match '"selectedClassicCount":(\d+)') { Write-Host "Selected classic: $($Matches[1])" }
    if ($content -match '"selectedScorerCount":(\d+)') { Write-Host "Selected scorer: $($Matches[1])" }
    if ($content -match '"rejectedCount":(\d+)') { Write-Host "Rejected: $($Matches[1])" }
    if ($content -match '"totalCostUsd":([\d.]+)') { Write-Host "Total cost USD: `$$($Matches[1])" }
    if ($content -match '"totalDurationMs":(\d+)') { Write-Host "Duration: $($Matches[1])ms" }
    if ($content -match '"fixturesCount":(\d+)') { Write-Host "Fixtures fetched: $($Matches[1])" }
    Write-Host ""
    Write-Host "=== FIRST 1500 CHARS OF RESPONSE ==="
    $content.Substring(0, [Math]::Min(1500, $content.Length))
} catch {
    Write-Host "STATUS:" $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "ERROR:"
    Write-Host ($reader.ReadToEnd())
}
