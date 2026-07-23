'use client';

/** درع أخير: خطأ في الهيكل الجذري نفسه — صفحة استرداد مستقلة بالكامل */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ background: '#070b14', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: 40 }}>😅</p>
            <h2 style={{ fontWeight: 900 }}>حدث خطأ غير متوقع في النظام</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
              بياناتك سليمة. اضغط إعادة المحاولة أو أعد تشغيل النظام من START.bat
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(270deg, #34d399, #2dd4bf)',
                color: '#070b14',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
