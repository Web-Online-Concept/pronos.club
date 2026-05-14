# ====================================================================
# CLEANUP O05 PHASE 4 v2 - Suppression de l'ancien frontend
# ====================================================================
# CORRECTION : utilisation de -LiteralPath partout pour gerer les
# chemins contenant des caracteres speciaux PowerShell : [ ] ( )
#
# A executer depuis la racine du repo : E:\github\pronos.club
# ====================================================================

Write-Host ""
Write-Host "Nettoyage de l'ancien frontend O05 (v2)..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath "vercel.json")) {
    Write-Host "ERREUR : pas dans E:\github\pronos.club" -ForegroundColor Red
    exit 1
}

# Liste des cibles a supprimer (chemins avec crochets et parentheses)
$targets = @(
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\page.tsx"; Type = "Fichier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\[id]\page.tsx"; Type = "Fichier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\[id]"; Type = "Dossier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\historique\page.tsx"; Type = "Fichier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\historique"; Type = "Dossier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\OpportunityCard.tsx"; Type = "Fichier" },
    @{ Path = "src\app\[locale]\(auth)\espace\over-05-buts-equipes\PsychoSection.tsx"; Type = "Fichier" }
)

$deletedCount = 0
$notFoundCount = 0

foreach ($target in $targets) {
    $path = $target.Path
    $type = $target.Type

    # IMPORTANT : -LiteralPath pour empecher PowerShell d'interpreter [id] comme wildcard
    if (Test-Path -LiteralPath $path) {
        try {
            Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
            Write-Host "[OK]      Supprime : $path ($type)" -ForegroundColor Green
            $deletedCount++
        }
        catch {
            Write-Host "[ERREUR]  $path : $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "[ABSENT]  Introuvable : $path" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  RESUME : $deletedCount supprimes, $notFoundCount introuvables" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Verification post-suppression
Write-Host "Verification : recherche de references residuelles..." -ForegroundColor Cyan
$residuals = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Select-String -Pattern "OpportunityCard|detect-opportunities|detect-stakes|api/over-05-buts-equipes/opportunities|api/over-05-buts-equipes/results" -ErrorAction SilentlyContinue

if ($residuals) {
    Write-Host "[WARN] References encore presentes :" -ForegroundColor Yellow
    $residuals | Select-Object Path, LineNumber, Line | Format-Table -AutoSize -Wrap
    Write-Host ""
    Write-Host "Corrige-les avant npm run build." -ForegroundColor Yellow
}
else {
    Write-Host "[OK] Aucune reference residuelle." -ForegroundColor Green
}

Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor Cyan
Write-Host "   1. Placer les nouveaux fichiers de la Phase 4 (Lot A + Lot B)"
Write-Host "   2. npm run build"
Write-Host "   3. Si OK : git add -A puis git commit"
Write-Host ""
