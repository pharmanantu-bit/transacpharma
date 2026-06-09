# start.ps1 — lance TransacPharma en développement (Windows / PowerShell)
#
#   Usage :  clic droit > "Exécuter avec PowerShell"
#            ou dans un terminal :  .\start.ps1
#
# - Installe les dépendances au premier lancement (si node_modules absent)
# - Démarre le serveur Express + le client Vite sur le PORT 3002
#   (le 3000 est souvent déjà pris par un autre projet)
# - Ouvre http://localhost:5173 dans le navigateur

$ErrorActionPreference = 'Stop'

# Se placer dans le dossier du script (le repo), quel que soit le cwd
Set-Location -Path $PSScriptRoot

Write-Host "=== TransacPharma — démarrage ===" -ForegroundColor Cyan

# Vérifie que Node est disponible
try {
    $nodeVersion = node -v
    Write-Host "Node $nodeVersion détecté." -ForegroundColor DarkGray
} catch {
    Write-Host "Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance." -ForegroundColor Red
    exit 1
}

# Installe les dépendances si nécessaire (racine + client)
if (-not (Test-Path 'node_modules') -or -not (Test-Path 'client/node_modules')) {
    Write-Host "Installation des dépendances (premier lancement)..." -ForegroundColor Yellow
    npm run install:all
}

# Configuration des ports : serveur 3002, le proxy Vite cible ce même port
$env:PORT = "3002"
$env:API_PROXY = "http://localhost:3002"

Write-Host "Serveur API  : http://localhost:3002/api" -ForegroundColor Green
Write-Host "Interface    : http://localhost:5173" -ForegroundColor Green
Write-Host "(Ctrl+C pour arrêter)" -ForegroundColor DarkGray

# Ouvre le navigateur après un court délai, sans bloquer le serveur
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 6
    Start-Process "http://localhost:5173"
} | Out-Null

# Lance serveur + client (bloquant)
npm run dev
