@echo off
chcp 65001 >nul
title نظام حياتي — تحديث قاعدة البيانات

echo.
echo ============================================
echo    نظام حياتي — تحديث قاعدة البيانات
echo ============================================
echo.
echo  ما سيحدث بعد قليل:
echo.
echo   1. سيفتح المتصفح تلقائياً.
echo   2. سجّل الدخول بحساب:  himoadobe@gmail.com
echo   3. اضغط زر الموافقة (Authorize).
echo   4. ارجع إلى هذه النافذة واتركها تكمل وحدها.
echo.
echo  ملاحظة: إن طُلبت منك "database password" اضغط Enter فقط.
echo.
echo ============================================
echo.
pause

echo.
echo [1/3] تسجيل الدخول إلى Supabase...
echo.
call npx supabase login
if %errorlevel% neq 0 (
  echo.
  echo ❌ فشل تسجيل الدخول.
  echo    التقط صورة لهذه النافذة وأرسلها.
  echo.
  pause
  exit /b 1
)
echo.
echo ✅ تم تسجيل الدخول
echo.

echo [2/3] ربط المشروع الصحيح...
echo.
call npx supabase link --project-ref yruoooslxppvsoqdbgxc
echo.

echo [3/3] تشغيل التحديث على قاعدة البيانات...
echo.
call npx supabase db push --include-all
if %errorlevel% neq 0 (
  echo.
  echo ❌ فشل التحديث.
  echo    التقط صورة لهذه النافذة وأرسلها — لا تقلق، بياناتك سليمة.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo.
echo    ✅ تم بنجاح
echo.
echo    ارجع إلى Claude واكتب:  تم
echo.
echo ============================================
echo.
pause
