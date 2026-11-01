# بازیابی اجرای GitHub Actions — Playora

آخرین بررسی: 2026-10-23

## شواهد فعلی

- مخزن: `kamyarmohamadi/playora_app` (خصوصی).
- شاخهٔ توسعه: `feature/playora-platform-game-plugin-architecture-2026-10-22`.
- فایل workflow: `.github/workflows/ci.yml`.
- اجراهای اخیر: [39877067881](https://github.com/kamyarmohamadi/playora_app/actions/runs/39877067881)، [39877036826](https://github.com/kamyarmohamadi/playora_app/actions/runs/39877036826).
- سه job در اجرای جدید در وضعیت failed هستند؛ پاسخ خام Jobs API برای هر سه `runner_id: 0`، `runner_name: ""` و `steps: []` را برمی‌گرداند. هر job ظرف حدود 1–2 ثانیه بسته شده و لاگ قابل دریافت نیست.
- این الگو نشان می‌دهد job به runner نرسیده است؛ به‌تنهایی ثابت نمی‌کند که تست یا کد شکست خورده است.
- workflow از `ubuntu-latest` استفاده می‌کند و `permissions: contents: read` دارد. این سطح دسترسی را برای رفع خطای اجرا افزایش ندهید.
- برای امکان اجرای دستی پس از رفع مشکل، trigger `workflow_dispatch` به workflow اضافه شده است؛ اجرای خودکار push همچنان فعال است. این تغییر به‌تنهایی مشکل تخصیص runner را حل نمی‌کند.

## چک‌لیست بررسی در GitHub UI

1. مخزن را باز کنید و به **Settings → Actions → General** بروید.
2. بررسی کنید Actions برای مخزن غیرفعال نشده باشد و سیاست Actions اجازهٔ اجرای workflowهای موجود را بدهد.
3. در **Actions → Runners**، اگر بخش runnerها برای این مخزن در دسترس است، وضعیت runnerهای self-hosted را بررسی کنید. این workflow به runner برچسب `ubuntu-latest` نیاز دارد؛ در حالت معمول باید GitHub-hosted runner تخصیص داده شود.
4. بخش billing/usage حساب یا سازمان را برای محدودیت‌های Actions minutes، پرداخت یا محدودیت‌های حساب بررسی کنید. از شواهد فعلی نمی‌توان گفت این علت قطعی است.
5. بازکردن اجرای workflow و job details باید پس از رفع مشکل، زمان شروع، runner و فهرست steps را نشان دهد.
6. بعد از اصلاح تنظیمات، از **Actions → Playora quality gate → Run workflow** روی شاخهٔ توسعه استفاده کنید یا یک commit عادی ارسال کنید. انتظار می‌رود هر سه job حداقل steps واقعی و لاگ داشته باشند.
7. اگر همچنان `runner_id: 0` و بدون step بود، از GitHub Support/مالک سازمان بخواهید بررسی کند چرا hosted runner برای مخزن خصوصی تخصیص نمی‌یابد.

## معیار پایان این مانع

- هر سه job روی همان commit واقعی runner داشته باشند.
- unit tests، typecheck، production build، Chromium E2E، PostgreSQL security tests و Deno checks واقعاً اجرا شوند.
- نتیجهٔ موفق به commit دقیق مربوط باشد؛ اجرای سبز قدیمی جایگزین اجرای سبز commit جدید نیست.

تا آن زمان، migration ظرفیت روی Supabase زنده اجرا نشود، هیچ تستی از workflow حذف نشود و PR #7 merge نشود.

## یافتهٔ تکمیلی از بررسی metadata مخزن

- شاخهٔ توسعه در پاسخ GitHub Branch API در زمان بررسی `protected: false` و `required_status_checks.enforcement_level: off` گزارش شده است. بنابراین فعلاً تضمینی در سطح branch protection وجود ندارد که PR فقط با CI موفق ادغام شود.
- این وضعیت را در این مرحله فقط ثبت کرده‌ایم؛ ابزار اتصال فعلی امکان تغییر تنظیمات branch protection را در اختیار نمی‌گذارد. مالک مخزن باید از **Settings → Branches** برای شاخهٔ هدف، rule/ ruleset مناسب بسازد و پس از رفع مشکل runner، jobهای لازم را به‌عنوان required checks انتخاب کند.
- تا وقتی checkها به‌درستی اجرا نشده‌اند، صرفاً required کردن نام‌های check بدون آزمودنشان ممکن است فرایند ادغام را قفل کند؛ ابتدا Actions را به وضعیت قابل اجرا برگردانید، سپس protection را با checkهای واقعی تنظیم کنید.

## آخرین تأیید اجرای خراب

در 2026-10-23، اجرای push [39877323279](https://github.com/kamyarmohamadi/playora_app/actions/runs/39877323279) و اجرای مرتبط PR [39877327734](https://github.com/kamyarmohamadi/playora_app/actions/runs/39877327734) هر دو با سه job شکست‌خورده برگشتند. هر شش job `runner_id: 0`، `runner_name: ""` و `steps: []` داشتند. این وضعیت همچنان خطای تخصیص/شروع runner را محتمل‌تر از خطای تست می‌کند، اما علت ریشه‌ای هنوز تأیید نشده است.
