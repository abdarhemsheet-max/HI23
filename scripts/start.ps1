# نظام حياتي — سكربت التشغيل السريع
# ملاحظة: المنطق كله هنا (وليس في START.bat) لأن PowerShell يتعامل مع
# النصوص العربية والرموز التعبيرية (UTF-8) بشكل موثوق، بخلاف cmd.exe
# الذي قد يُخطئ أحياناً في تقطيع أسطر Batch تحتوي عربي + رموز مع chcp 65001.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = 'نظام حياتي — عبدالرحيم أحمد شيتة' } catch {}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Info($msg)  { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)    { Write-Host $msg -ForegroundColor Green }
function Warn($msg)  { Write-Host $msg -ForegroundColor Yellow }
function Fail($msg)  { Write-Host $msg -ForegroundColor Red }

function StopAndExit {
    Write-Host ''
    Read-Host 'اضغط Enter للإغلاق'
    exit 1
}

Write-Host ''
Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host '   🌟  نظام حياتي — التشغيل السريع' -ForegroundColor DarkCyan
Write-Host '   (وضع الإنتاج — سرعة قصوى ⚡)' -ForegroundColor DarkCyan
Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host ''

# 1) التحقق من وجود Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail '[خطأ] Node.js غير مثبت! حمّله من https://nodejs.org ثم أعد المحاولة.'
    StopAndExit
}

# 2) تثبيت الحزم عند أول تشغيل فقط
if (-not (Test-Path 'node_modules')) {
    Info '[1/4] تثبيت الحزم لأول مرة... قد يستغرق بضع دقائق ⏳'
    npm install
    if ($LASTEXITCODE -ne 0) {
        Fail '[خطأ] فشل تثبيت الحزم. تأكد من اتصال الإنترنت.'
        StopAndExit
    }
} else {
    Ok '[1/4] الحزم مثبتة ✓'
}

# 3) إنشاء قاعدة البيانات المحلية (SQLite) عند أول تشغيل
if (-not (Test-Path 'prisma\dev.db')) {
    Info '[2/4] إنشاء قاعدة البيانات المحلية...'
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Fail '[خطأ] فشل إنشاء قاعدة البيانات. جرّب: npx prisma db push'
        StopAndExit
    }
} else {
    Ok '[2/4] قاعدة البيانات جاهزة ✓'
}

# 4) بناء نسخة الإنتاج عند الحاجة (كل الصفحات تُجهز مسبقاً = تنقل فوري)
if (-not (Test-Path '.next\BUILD_ID')) {
    Info '[3/4] بناء نسخة الإنتاج لأول مرة... دقيقة واحدة تقريباً ⏳'
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Fail '[خطأ] فشل البناء. شغّل update.bat وأعد المحاولة.'
        StopAndExit
    }
} else {
    Ok '[3/4] نسخة الإنتاج جاهزة ✓  (بعد أي تحديث للكود شغّل update.bat)'
}

# 5) تشغيل الخادم وفتح المتصفح
Info '[4/4] تشغيل النظام... سيُفتح المتصفح تلقائياً'
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 4
    Start-Process 'http://localhost:4400'
} | Out-Null
Warn '        ✦ لإيقاف النظام أغلق هذه النافذة أو اضغط Ctrl+C'
Write-Host ''

npm run start

Write-Host ''
Read-Host 'اضغط Enter للإغلاق'
