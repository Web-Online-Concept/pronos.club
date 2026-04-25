$headers = @{ "x-admin-email" = "flotoulouse7@gmail.com" }
$r = Invoke-WebRequest -Uri "https://www.pronos.club/api/debug/ai-consensus-test?mode=raw-claude" -Headers $headers -UseBasicParsing -TimeoutSec 180
$content = $r.Content
Write-Host "STATUS:" $r.StatusCode "| LENGTH:" $r.Content.Length
Write-Host ""
if ($content -match '"tokensInput":(\d+)') { Write-Host "Input tokens: $($Matches[1])" }
if ($content -match '"tokensOutput":(\d+)') { Write-Host "Output tokens: $($Matches[1])" }
if ($content -match '"latencyMs":(\d+)') { Write-Host "Latency: $($Matches[1])ms" }
if ($content -match '"costUsd":([\d.]+)') { Write-Host "Cost USD: `$$($Matches[1])" }
if ($content -match '"error":"([^"]+)"') { Write-Host "ERROR: $($Matches[1])" } else { Write-Host "Error: none" }
Write-Host ""
Write-Host "=== RAW RESPONSE CLAUDE (les 2000 premiers chars) ==="
$content.Substring(0, [Math]::Min(2500, $content.Length))
