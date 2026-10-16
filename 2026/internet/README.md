# کارگاه اینترنت رستا

صفحهٔ اصلی: [https://rastaiha.github.io/minigames/2026/internet/](https://rastaiha.github.io/minigames/2026/internet/)

این پروژه سایت Astro، مقدمه و بازی‌های مستقل کارگاه اینترنت را نگه می‌دارد.
هر بازی ابزار ساخت و وابستگی‌های خودش را دارد. پوشهٔ `steps/` عمداً فقط یک
`.gitkeep` خالی دارد؛ محتوای گام‌ها و تنظیمات Google Docs وارد این مخزن نشده‌اند.
بازی قدیمی `routing-old` و submodule آن هم منتقل نشده‌اند.

از همین پوشه اجرا کنید:

```sh
npm ci
npm test
npm run dev
npm run build
```

`dev` و `build` بازی‌ها و مقدمه را آماده می‌کنند. ساخت نهایی بازی‌ها از lockfile
هر بازی با `npm ci` استفاده می‌کند. خروجی سایت در `site/dist/` ساخته می‌شود.
اجرای سایت، تست‌ها و build به اعتبارنامهٔ Google Docs نیاز ندارد.

از ریشهٔ مخزن، `node scripts/workshops.mjs build 2026/internet` مسیر انتشار را
تنظیم و خروجی را برای GitHub Pages آماده می‌کند. `workshop.json` فقط فرمان‌های
محلی و پوشهٔ خروجی را به ابزار مشترک معرفی می‌کند.

راهنمای توسعه و بازی‌های چندصفحه‌ای در [docs/development.md](docs/development.md)
و [docs/mini-games.md](docs/mini-games.md) است.
