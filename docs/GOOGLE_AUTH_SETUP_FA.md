# راه‌اندازی ورود Playora با Google و ایمیل

این راهنما تنظیمات لازم برای فعال شدن ورود واقعی را توضیح می‌دهد. وجود دکمهٔ Google در رابط کاربری به‌تنهایی به معنی فعال بودن OAuth نیست؛ هر سه بخش زیر باید تنظیم و سپس با حساب آزمایشی بررسی شوند.

## ۱. تنظیم Supabase Auth

پروژهٔ توسعهٔ Playora:

- Dashboard: https://supabase.com/dashboard/project/nnowvfewtrfurnluhflt
- API URL: https://nnowvfewtrfurnluhflt.supabase.co

در **Authentication → URL Configuration**:

- Site URL را روی آدرس دقیق محیطی که برنامه از آن اجرا می‌شود قرار بده.
- Redirect URLs را برای هر محیط جداگانه اضافه کن؛ برای توسعهٔ محلی، `http://localhost:5173/**` و برای محیط میزبانی‌شده، فقط دامنهٔ واقعی و تحت کنترل پروژه را اضافه کن.
- از wildcard گسترده برای دامنه‌های نامرتبط استفاده نکن.

## ۲. فعال‌کردن Google provider

۱. در Google Cloud Console یک OAuth Client از نوع **Web application** بساز.
۲. در بخش **Authorized redirect URIs** این callback را ثبت کن:

```text
https://nnowvfewtrfurnluhflt.supabase.co/auth/v1/callback
```

۳. Client ID و Client Secret تولیدشده را در **Supabase Dashboard → Authentication → Providers → Google** وارد و provider را فعال کن.
۴. Client Secret فقط در داشبورد Supabase وارد شود؛ هرگز آن را در `.env` دارای متغیر `VITE_*`، کد React، GitHub یا مرورگر قرار نده.

## ۳. تنظیم متغیرهای فرانت‌اند

در محیط محلی، فایل نادیده‌گرفته‌شدهٔ `.env.local` را از روی `.env.example` بساز و مقادیر browser-safe زیر را پر کن:

```dotenv
VITE_SUPABASE_URL=https://nnowvfewtrfurnluhflt.supabase.co
VITE_SUPABASE_ANON_KEY=<SUPABASE_PUBLISHABLE_OR_LEGACY_ANON_KEY>
```

در میزبانی نهایی همین دو متغیر را از بخش environment variables تنظیم کن و بعد از تغییر آن‌ها build جدید منتشر کن. از `service_role` یا secret key در فرانت‌اند استفاده نکن.

## ۴. آزمون پذیرش ورود

- ورود Google در محیط توسعه و دامنهٔ نهایی به Supabase برمی‌گردد.
- ثبت‌نام ایمیلی، تأیید ایمیل، ورود، خروج و بازیابی رمز عبور با حساب‌های آزمایشی بررسی می‌شوند.
- نشست پس از بارگذاری مجدد صفحه حفظ می‌شود و کاربر از داده‌های کاربر دیگر چیزی نمی‌بیند.
- Redirect به دامنهٔ ناشناخته یا ثبت‌نشده رد می‌شود.
- در صورت نبودن متغیرهای Supabase، رابط کاربری صریحاً اعلام می‌کند که سرویس حساب هنوز متصل نیست و دکمه‌های ورود غیرفعال می‌مانند.

## وضعیت فعلی

کد ورود با ایمیل/رمز عبور، ثبت‌نام، بازیابی رمز و فراخوانی `signInWithOAuth({ provider: "google" })` در اپ وجود دارد. **فعال بودن واقعی Google هنوز به پیکربندی provider، متغیرهای محیطی، redirect allowlist و آزمون زنده وابسته است**؛ این مخزن به‌تنهایی Client Secret یا تنظیمات داشبورد را ایجاد نمی‌کند.
