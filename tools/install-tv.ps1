<#
  Builds the app, signs it with the Samsung certificate profile and installs + starts it on the TV.
    .\tools\install-tv.ps1
  Needs: Tizen Studio CLI in C:\tizen-studio, the TV in Developer Mode with this PC's IP,
  and the "LunarTV" profile in Certificate Manager (the distributor cert holds the TV's DUID).
#>
param(
  [string]$Tv = '192.168.50.15',
  [string]$Profile = 'LunarTV'
)
$ErrorActionPreference = 'Stop'
$tizen = 'C:\tizen-studio\tools\ide\bin\tizen.bat'
$sdb = 'C:\tizen-studio\tools\sdb.exe'
$src = Split-Path $PSScriptRoot
$stage = Join-Path $env:TEMP 'tvdashboard-build'

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
foreach ($f in 'config.xml', 'index.html', 'icon.png', 'css', 'js') { Copy-Item (Join-Path $src $f) $stage -Recurse }

& $tizen package -t wgt -s $Profile -- $stage
$wgt = Get-ChildItem $stage -Filter *.wgt | Select-Object -First 1
if (-not $wgt) { throw 'Packaging failed' }
# The TV's installer fails on file names with spaces ("Home Lab.wgt").
Rename-Item $wgt.FullName 'HomeLab.wgt'

& $sdb connect $Tv | Out-Null
& $tizen install -n HomeLab.wgt -s "${Tv}:26101" -- $stage
& $tizen run -p LunDashTV1.HomeLab -s "${Tv}:26101"
