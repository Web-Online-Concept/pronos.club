# ====================================================================
# CLEANUP O05 - Suppression de l'ancienne methode "intrinsics"
# ====================================================================
# Supprime les fichiers/dossiers de l'ancienne methode (calcul des
# niveaux intrinseques) qui sont remplaces par la nouvelle methode
# PROJETS stockee en DB Supabase.
#
# A executer depuis la racine du repo : E:\github\pronos.club
# ====================================================================

Write-Host ""
Write-Host "Nettoyage des fichiers O05 obsoletes..." -ForegroundColor Cyan
Write-Host ""

# Verifier qu'on est bien a la racine du repo
if (-not (Test-Path "vercel.json")) {
    Write-Host "ERREUR : vercel.json introuvable. Es-tu bien dans E:\github\pronos.club ?" -ForegroundColor Red
    exit 1
}

# Liste des cibles a supprimer
$targets = @(
    @{ Path = "src\app\api\cron\over-05-buts-equipes-detect"; Type = "Dossier" },
    @{ Path = "src\app\api\over-05-buts-equipes\admin\compute-intrinsics"; Type = "Dossier" },
    @{ Path = "src\lib\over-05-buts-equipes\compute-intrinsics.ts"; Type = "Fichier" },
    @{ Path = "src\lib\over-05-buts-equipes\refresh-current-season.ts"; Type = "Fichier" }
)

$deletedCount = 0
$notFoundCount = 0

foreach ($target in $targets) {
    $path = $target.Path
    $type = $target.Type

    if (Test-Path $path) {
        try {
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-Host "[OK]      Supprime : $path ($type)" -ForegroundColor Green
            $deletedCount++
        }
        catch {
            Write-Host "[ERREUR]  $path : $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "[ABSENT]  Introuvable (deja supprime ?) : $path" -ForegroundColor Yellow
        $notFoundCount++
    }
}

# Nettoyer le dossier parent admin/ si devenu vide
$adminDir = "src\app\api\over-05-buts-equipes\admin"
if ((Test-Path $adminDir) -and ((Get-ChildItem $adminDir -Force | Measure-Object).Count -eq 0)) {
    Remove-Item -Path $adminDir -Force
    Write-Host "[OK]      Dossier vide supprime : $adminDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  RESUME : $deletedCount supprimes, $notFoundCount introuvables" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Verification post-suppression : il ne doit plus rester de reference
Write-Host "Verification : recherche de references residuelles..." -ForegroundColor Cyan
$residuals = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Select-String -Pattern "compute-intrinsics|refresh-current-season|over-05-buts-equipes-detect" -ErrorAction SilentlyContinue

if ($residuals) {
    Write-Host "[WARN] References encore presentes :" -ForegroundColor Yellow
    $residuals | Select-Object Path, LineNumber, Line | Format-Table -AutoSize -Wrap
    Write-Host ""
    Write-Host "Si des fichiers les utilisent encore, corrige-les manuellement avant npm run build." -ForegroundColor Yellow
}
else {
    Write-Host "[OK] Aucune reference residuelle. Tu peux lancer npm run build." -ForegroundColor Green
}

Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor Cyan
Write-Host "   1. Remplacer vercel.json (fichier fourni par Claude)"
Write-Host "   2. npm run build"
Write-Host "   3. Si OK : git add -A puis git commit"
Write-Host ""
