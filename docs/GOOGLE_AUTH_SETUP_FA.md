undefined
## ۵. مسیر بازگشت ورود Google در APK اندروید

نسخه نصب‌شدهٔ Capacitor نباید از `window.location.origin` برای برگشت Google استفاده کند؛ مبدأ داخلی WebView می‌تواند به صفحهٔ 404 منتهی شود. کد فعلی اندروید از Deep Link زیر استفاده می‌کند:

```text
com.playora.app://auth/callback
```

در **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** همین آدرس را دقیقاً به فهرست مجاز اضافه کن. Site URL وب را تغییر نده.

در **Google Cloud → Google Auth Platform → Clients → Web application**، آدرس مجاز بازگشت Google باید همچنان callback خود Supabase باشد، نه Deep Link اندروید:

```text
https://nnowvfewtrfurnluhflt.supabase.co/auth/v1/callback
```

اپ از مرورگر سیستم برای ورود استفاده می‌کند و پس از بازگشت Deep Link، کد PKCE را داخل اپ با `exchangeCodeForSession` مبادله می‌کند. پس از ثبت Redirect URL در Supabase، APK جدید را روی گوشی واقعی آزمایش کن.
