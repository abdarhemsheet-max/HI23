# نظام حياتي — سكربت تحديث النظام بعد تعديل الكود

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = 'نظام حياتي — تحديث النظام' } catch {}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host $msg -ForegroundColor Green }
function Fail($msg) { Write-Host $msg -ForegroundColor Red }

function StopAndExit {
    Write-Host ''
    Read-Host 'اضغط Enter للإغلاق'
    exit 1
}

Write-Host ''
Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host '   🔄  تحديث نظام حياتي' -ForegroundColor DarkCyan
Write-Host '   شغّل هذا الملف بعد أي تعديل على الكود' -ForegroundColor DarkCyan
Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host ''

Info '[1/3] تحديث الحزم...'
npm install
if ($LASTEXITCODE -ne 0) { Fail '[خطأ] فشل تثبيت الحزم'; StopAndExit }

Info '[2/3] مزامنة قاعدة البيانات (بياناتك محفوظة)...'
npx prisma db push
if ($LASTEXITCODE -ne 0) { Fail '[خطأ] فشلت مزامنة قاعدة البيانات'; StopAndExit }

Info '[3/3] بناء نسخة الإنتاج الجديدة...'
npm run build
if ($LASTEXITCODE -ne 0) { Fail '[خطأ] فشل البناء'; StopAndExit }

Write-Host ''
Ok '✅ اكتمل التحديث! شغّل START.bat الآن.'
Write-Host ''
Read-Host 'اضغط Enter للإغلاق'
