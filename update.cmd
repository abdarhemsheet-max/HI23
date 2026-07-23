@echo off
chcp 65001 >nul
title نظام حياتي — رفع التعديلات

echo.
echo ============================================
echo    نظام حياتي — رفع التعديلات
echo ============================================
echo.

:: 1. Git status
echo [1/6] التحقق من حالة الملفات...
git status
echo.

:: 2. Add all files
echo [2/6] إضافة جميع التعديلات...
git add -A
if %errorlevel% neq 0 (
  echo ❌ فشل في إضافة الملفات
  pause
  exit /b 1
)
echo ✅ تمت الإضافة
echo.

:: 3. Commit
echo [3/6] إنشاء commit...
for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value"') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%
git commit -m "تحديث %TIMESTAMP%"
if %errorlevel% neq 0 (
  echo لا توجد تغييرات جديدة للرفع — استمرار...
) else (
  echo ✅ تم إنشاء commit
)
echo.

:: 4. Push to GitHub
echo [4/6] رفع إلى GitHub...
git push
if %errorlevel% neq 0 (
  echo ❌ فشل الرفع إلى GitHub — تحقق من الاتصال
  pause
  exit /b 1
)
echo ✅ تم الرفع إلى GitHub
echo.

:: 5. Deploy Supabase Edge Functions
echo [5/6] رفع Edge Functions إلى Supabase...
call npx supabase functions deploy b2-upload --no-verify-jwt
call npx supabase functions deploy b2-download --no-verify-jwt
call npx supabase functions deploy b2-delete --no-verify-jwt
echo ✅ تم رفع Edge Functions
echo.

:: 6. Summary
echo [6/6] ✅ تم بنجاح — التحديثات في الطريق إلى GitHub Pages
echo.
echo    الرابط: https://abdarhemsheet-max.github.io/HI23/
echo    وقت التحديث: %TIMESTAMP%
echo.
echo ============================================

pause
