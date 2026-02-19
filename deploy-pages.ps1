param(
  [string]$ProjectName = "adas-interactive",
  [string]$DeployDir = ".pages-deploy"
)

$ErrorActionPreference = "Stop"

$files = @(
  "index.html",
  "cases.html",
  "deploy.html",
  "style.css",
  "app.js",
  "cases.js",
  "case-library.js"
)

if (Test-Path $DeployDir) {
  Remove-Item $DeployDir -Recurse -Force
}

New-Item -ItemType Directory -Path $DeployDir | Out-Null

foreach ($file in $files) {
  Copy-Item $file -Destination (Join-Path $DeployDir (Split-Path $file -Leaf)) -Force
}

npx wrangler pages deploy $DeployDir --project-name $ProjectName --commit-dirty=true