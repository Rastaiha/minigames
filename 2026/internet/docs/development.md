# توسعه و انتشار وب‌سایت کارگاه

این نسخه در `2026/internet/` مخزن minigames نگهداری می‌شود. سایت Astro، مقدمه و
بازی‌ها مستقل‌اند و تنظیماتشان داخل همین پروژه قرار دارد.

## پیش‌نیازها و فرمان‌ها

Node.js 22.12 یا جدیدتر لازم است. از پوشهٔ همین پروژه اجرا کنید:

```sh
npm ci
npm test
npm run dev
npm run build
```

`npm test` تست‌های سایت، ابزارهای محتوا و منطق بازی‌ها را اجرا می‌کند. `dev` و
`build` ابتدا بازی‌ها و مقدمه را در `site/public/` آماده می‌کنند. خروجی نهایی
Astro در `site/dist/` ساخته می‌شود؛ فایل‌های تولیدشده commit نمی‌شوند.

## محتوای این نسخه

- `steps/` عمداً به‌جز `.gitkeep` خالی است و هیچ گام دانش‌آموز یا منتوری منتشر نمی‌شود.
- سایت با نبودن `steps/.order.json` هم ساخته می‌شود؛ صفحهٔ اصلی مقدمه و بازی‌ها را نشان می‌دهد.
- `routing-old` و submodule آن منتقل نشده‌اند؛ نیازی به آماده‌سازی submodule نیست.
- اعتبارنامه‌ها و `step-names.json` مربوط به Google Docs منتقل نشده‌اند.
- ابزارهای قدیمی import در `scripts/` باقی مانده‌اند، ولی بخشی از dev، تست یا build نیستند
  و هیچ گردش‌کار import خودکاری در این مخزن ثبت نشده است.

برای اجرای سایت یا بازی‌ها، فایل OAuth، توکن، دسترسی Google Docs یا import لازم نیست.

## قراردادن مقدمه

مقدمه یک وب‌اپ مستقل در `intro/` است و صفحهٔ ورود آن باید در
`intro/slides.html` قرار بگیرد. در زمان `dev` یا `build` این پوشه به‌طور موقت در
`site/public/intro/` کپی می‌شود. آماده‌ساز از محتوای `slides.html` یک نسخهٔ کوتاه
می‌سازد و لینک مقدمه را در صفحهٔ اصلی و گام اول به‌شکل
`intro/slides.html?v=...` می‌نویسد؛ بنابراین با تغییر مقدمه، مرورگر نسخهٔ تازه را
به‌جای کپی cacheشده باز می‌کند.

## قراردادن بازی‌ها

راهنمای کامل انگلیسی برای هدف آموزشی، طراحی بصری، ساخت، چندصفحه‌ای‌کردن و
بازآرایی بازی‌های موجود در [`docs/mini-games.md`](mini-games.md) آمده است. برای
هر بازی تازه یا بازی‌ای که به‌طور اساسی بازآرایی می‌شود، استفاده از Vite الزامی
است؛ پشتیبانی از HTML بدون build که پایین‌تر توضیح داده شده فقط برای بازی‌های
قدیمی و ساده حفظ شده است.

هر بازی در `games/<game-name>/` قرار می‌گیرد. آماده‌ساز سایت یکی از این دو شکل را
می‌پذیرد:

```text
games/router/dist/index.html
```

یا برای یک بازی سادهٔ بدون build:

```text
games/router/index.html
```

اگر پوشهٔ بازی `package.json` با scriptای به نام `build` داشته باشد، آماده‌ساز
سایت پیش از کپی‌کردن خروجی، dependencyها را آماده و `npm run build` را داخل
همان پوشه اجرا می‌کند. در `dev`، `node_modules` تا وقتی `package.json` یا
`package-lock.json` تغییر نکرده باشد دوباره استفاده می‌شود؛ در build نهایی،
`npm ci` همیشه اجرا می‌شود تا خروجی reproducible بماند. چنین بازی‌ای باید
`package-lock.json` داشته باشد و خروجی نهایی را در `dist/index.html`
بسازد. بازی‌های HTML ساده که
`package.json` ندارند مستقیماً کپی می‌شوند.

### چند بازی با کد مشترک در یک پروژه

اگر چند بازی اجزای مشترک دارند، آن‌ها را می‌توان به‌صورت چند صفحهٔ یک پروژه
ساخت؛ لازم نیست هر صفحه `package.json` و build جداگانه داشته باشد. در این حالت
پوشهٔ پروژه باید همچنان یک `index.html` در ریشه داشته باشد و build هم همان ساختار
مسیرها را داخل `dist/` نگه دارد. برای نمونه ساختار پروژهٔ کدگذاری داده چنین است:

```text
games/data-encoding/
├── index.html
├── shared/
├── manchester/index.html
├── timer/index.html
├── voltage/index.html
├── package.json
└── vite.config.js
```

و خروجی لازم آن:

```text
games/data-encoding/dist/
├── index.html
├── manchester/index.html
├── timer/index.html
└── voltage/index.html
```

در Vite، همهٔ صفحه‌ها ــ از جمله `index.html` ریشه ــ باید در
`build.rollupOptions.input` ثبت شوند. حذف ورودی ریشه باعث می‌شود قرارداد
آماده‌ساز سایت (`dist/index.html`) شکسته شود؛ ثبت‌نکردن یکی از صفحه‌های داخلی هم
باعث می‌شود آن مسیر در خروجی نهایی وجود نداشته باشد.

لینک‌های بین صفحه‌های چنین پروژه‌ای باید نسبت به فایل فعلی نوشته شوند و نام
`index.html` را صریح داشته باشند:

```html
<a href="./manchester/index.html">…</a>
<a href="./timer/index.html">…</a>
<a href="./voltage/index.html">…</a>
```

از مسیر مطلقی مثل `/manchester/` استفاده نکنید: بازی در سایت نهایی زیر
`/games/<project-name>/` قرار می‌گیرد و ممکن است کل سایت نیز با یک base path مثل
GitHub Project Pages منتشر شود. به مسیر پوشه‌ای مثل `./manchester/` هم تکیه نکنید؛
همهٔ static serverها تبدیل خودکار آن به `index.html` را یکسان انجام نمی‌دهند.
query string روی صفحهٔ مبدأ (برای نمونه `index.html?v=...`) در resolveشدن این
لینک‌های نسبی مشکلی ایجاد نمی‌کند.

بعد از ساخت یا تغییر یک بازی چندصفحه‌ای، این موارد را بررسی کنید:

1. `npm run build` در پوشهٔ پروژه موفق شود.
2. `dist/index.html` و `dist/<page>/index.html` برای تک‌تک صفحه‌ها وجود داشته باشد.
3. لینک‌های صفحهٔ اصلی به شکل `./<page>/index.html` باشند.
4. assetها و importهای مشترک نیز نسبی باشند و هیچ‌کدام ریشهٔ دامنه (`/`) را فرض نکنند.
5. صفحهٔ اصلی و همهٔ صفحه‌های داخلی را از مسیر نهایی
   `/games/<project-name>/.../index.html` آزمایش کنید، نه فقط از dev server خود Vite.

در زمان `dev` یا `build` خروجی بازی‌ها به `site/public/games/` کپی می‌شود.
این کپی هر بار از نو ساخته می‌شود و در Git نگهداری نمی‌شود.

## مسیر انتشار و GitHub Actions

از ریشهٔ مخزن:

```sh
node scripts/workshops.mjs install 2026/internet
node scripts/workshops.mjs check 2026/internet
node scripts/workshops.mjs build 2026/internet
```

ابزار مشترک `BASE_PATH=/minigames/2026/internet` و `SITE_URL` را به فرمان‌های
پروژه می‌دهد و فقط خروجی `site/dist/` را منتشر می‌کند. برای شبیه‌سازی محلی همین
مسیر، از پوشهٔ پروژه اجرا کنید:

```sh
BASE_PATH=/minigames/2026/internet SITE_URL=https://rastaiha.github.io npm run build
```

صفحهٔ اصلی در `https://rastaiha.github.io/minigames/2026/internet/` و مقدمه در
`https://rastaiha.github.io/minigames/2026/internet/intro/slides.html` قرار می‌گیرد.

گردش‌کار مشترک `../../.github/workflows/deploy-pages.yml` فرمان‌های `workshop.json`
را در runner مستقل اجرا می‌کند؛ workflow انتشار جداگانه‌ای برای این پروژه لازم نیست.
