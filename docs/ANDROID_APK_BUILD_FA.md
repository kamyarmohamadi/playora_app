# ساخت و نصب نسخهٔ اندروید Playora

## ساخت خودکار APK

در GitHub شاخهٔ توسعهٔ Playora را باز کن و از بخش **Actions → Playora Android APK → Run workflow** ساخت را اجرا کن. پس از سبز شدن کار، وارد همان اجرای موفق شو و از بخش **Artifacts** فایل `playora-android-debug-<commit>` را دریافت و ZIP را استخراج کن. فایل نصب داخل آن `app-debug.apk` است.

این APK نسخهٔ آزمایشی/Debug است و با امضای انتشار فروشگاهی تولید نمی‌شود. پیش از انتشار عمومی باید کلید امضای Release، سیاست به‌روزرسانی، حریم خصوصی و آزمون دستگاه واقعی آماده شود.

## اتصال سرویس حساب

ساخت APK از URL و کلید عمومی Supabase مربوط به محیط توسعه استفاده می‌کند. این کلید برای کلاینت طراحی شده و جایگزین سیاست‌های RLS نیست. هیچ service-role یا secret سمت سرور نباید وارد متغیرهای `VITE_*` شود.

در صورت نیاز می‌توانی در تنظیمات مخزن، Repository Variables با نام‌های `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` تعریف کنی تا مقادیر پیش‌فرض محیط توسعه override شوند.

## Google OAuth

ورود Google تا وقتی Google OAuth Client ID/Secret در Google Cloud و Supabase تنظیم نشود، فعال‌شده محسوب نمی‌شود. تنظیم callback وب در راهنمای [Google Auth](./GOOGLE_AUTH_SETUP_FA.md) آمده است. برای APK، بازگشت OAuth به اپ بومی و آزمون روی دستگاه واقعی نیز باید به‌صورت جداگانه تأیید شود؛ وجود دکمه یا موفقیت build به‌تنهایی آزمون ورود واقعی اندروید نیست.

## اگر ساخت شروع نشد

اگر GitHub Actions قبل از اجرای حتی یک Step با خطای Runner متوقف شد، این مشکل به معنی موفقیت یا شکست build نیست؛ باید تنظیمات Actions، سهمیه/صورتحساب و دسترسی Runner در GitHub بررسی شود. فایل APK فقط وقتی تحویل‌پذیر است که workflow موفق شده و artifact واقعاً در دسترس باشد.
