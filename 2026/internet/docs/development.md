# توسعه و انتشار وب‌سایت کارگاه

## پیش‌نیازها

- Node.js 22.12 یا جدیدتر
- دسترسی خواندن به Google Doc اصلی
- یک OAuth client و refresh token با دسترسی read-only به Docs

وابستگی‌ها را نصب کنید:

```sh
npm install
```

## تنظیم OAuth برای اجرای محلی و CI

importer فرایند دریافت رضایت کاربر یا ساخت refresh token را انجام نمی‌دهد. این دو
فایل را به‌شکل دستی در ریشهٔ مخزن قرار دهید:

```text
google-oauth-client.json
google-refresh-token.txt
```

فایل اول همان JSON مربوط به OAuth client است که Google Cloud می‌دهد. فایل دوم فقط
باید مقدار refresh token را، بدون عنوان یا پیشوند اضافی، داشته باشد. هر دو فایل در
`.gitignore` هستند و نباید commit شوند.

در هر اجرای `google:tabs` یا `import:steps`، برنامه با استفاده از client ID، client
secret و refresh token یک access token کوتاه‌عمر تازه از Google می‌گیرد. access
token روی دیسک ذخیره نمی‌شود.

### ساخت دستی refresh token با OAuth 2.0 Playground

در OAuth client از نوع Web application که قبلاً ساخته‌اید، این redirect URI را
اضافه کنید:

```text
https://developers.google.com/oauthplayground
```

سپس:

1. صفحهٔ `https://developers.google.com/oauthplayground/` را باز کنید.
2. پنجرهٔ تنظیمات را باز کنید و `Use your own OAuth credentials` را فعال کنید.
3. مطمئن شوید `OAuth flow` روی `Server-side` و `Access type` روی `Offline` است.
4. `client_id` و `client_secret` را از فایل JSON خودتان وارد کنید.
5. در Step 1 این scope را در `Input your own scopes` وارد کنید:

   ```text
   https://www.googleapis.com/auth/documents.readonly
   ```

6. روی `Authorize APIs` بزنید و حسابی را انتخاب کنید که Google Doc را می‌بیند.
7. در Step 2 روی `Exchange authorization code for tokens` بزنید.
8. مقدار `Refresh token` را در `google-refresh-token.txt` قرار دهید. access token
   نمایش‌داده‌شده لازم نیست.

حتماً در Playground از OAuth credential خودتان استفاده کنید؛ refresh tokenهای
ساخته‌شده با credential پیش‌فرض Playground بعد از ۲۴ ساعت revoke می‌شوند.

اگر OAuth consent screen پروژه از نوع External و در وضعیت Testing باشد، refresh
token برای scope مربوط به Docs معمولاً بعد از ۷ روز منقضی می‌شود. برای استفادهٔ
بلندمدت، وضعیت انتشار OAuth app را متناسب با حساب‌ها و سیاست‌های پروژه تنظیم کنید.

برای استفاده از فایل دیگری:

```sh
npm run google:tabs -- \
  --oauth-client-file path/to/client.json \
  --refresh-token-file path/to/refresh-token.txt

npm run import:steps -- \
  --oauth-client-file path/to/client.json \
  --refresh-token-file path/to/refresh-token.txt
```

## تعریف سند و نام گام‌ها

شناسهٔ Google Doc را در `step-names.json` قرار دهید:

```json
{
  "documentId": "DOCUMENT_ID",
  "names": {}
}
```

برای دیدن درخت tabها، عنوان‌ها و IDهای ثابت آن‌ها:

```sh
npm run google:tabs
```

سپس ID هر subtab را به نام مسیر گام نگاشت کنید:

```json
{
  "documentId": "DOCUMENT_ID",
  "names": {
    "t.abc123": "routing-first-hop",
    "t.def456": "routing-flooding"
  }
}
```

فقط subtabهایی که ID آن‌ها در `names` آمده باشد وارد وب‌سایت می‌شوند. برای حذف یک
subtab از وب‌سایت کافی است آن را در این نگاشت نیاورید؛ `google:tabs` آن را با علامت
`[omitted]` نشان می‌دهد. ترتیب subtabهای باقی‌مانده از خود Google Doc خوانده و در
`steps/.order.json` ثبت می‌شود. عنوان نمایشی هر گام از اولین heading سطح دو (`##`)
در بخش دانش‌آموز گرفته می‌شود، نه از عنوان subtab. نبودن این heading خطای import
است. همین heading پس از استخراج عنوان از `student.md` حذف می‌شود، چون سایت آن را
جداگانه در سربرگ گام نمایش می‌دهد؛ headingهای سطح دوی بعدی حفظ می‌شوند.

## واردکردن محتوا

```sh
npm run import:steps
```

پس از بررسی سند و تنظیمات، importer محتوای قبلی پوشهٔ `steps/` را کاملاً پاک
می‌کند و آن را فقط از subtabهای فعلیِ ثبت‌شده در `step-names.json` می‌سازد. در
نتیجه حذف یا تغییر نام یک نگاشت، فایل‌ها و assetهای قدیمی آن را هم در اجرای بعدی
حذف می‌کند.

برای هر گام این خروجی ساخته می‌شود:

```text
steps/<name>/student.md
steps/<name>/mentor-before.md
steps/<name>/mentor-after.md
steps/<name>/assets/*
```

راهنماهای `🟨` حذف نمی‌شوند؛ importer فقط دربارهٔ باقی‌ماندنشان هشدار می‌دهد.

لینک Google Docs به آدرسی مانند `http://games/router` باید در پاراگرافی مستقل
باشد. hostname ثابت `games` فقط یک قرارداد نویسندگی است و درخواست شبکه‌ای به آن
ارسال نمی‌شود. importer بخش بعد از hostname را به مسیر بازی تبدیل می‌کند؛ مثلاً
`http://games/router` در Markdown به iframe مربوط به
`/games/router/index.html` تبدیل می‌شود. استفادهٔ صریح از `index.html` باعث می‌شود
لینک بازی هم در dev server محلی Astro و هم در GitHub Pages کار کند.

## قراردادن بازی‌ها

هر بازی در `games/<game-name>/` قرار می‌گیرد. آماده‌ساز سایت یکی از این دو شکل را
می‌پذیرد:

```text
games/router/dist/index.html
```

یا برای یک بازی سادهٔ بدون build:

```text
games/router/index.html
```

در زمان `dev` یا `build`، خروجی بازی‌ها موقتاً به `site/public/games/` کپی می‌شود.
این کپی در Git نگهداری نمی‌شود و هر بار از نو ساخته می‌شود.

## اجرای محلی سایت

پس از import:

```sh
npm run dev
```

ساخت نسخهٔ static نهایی:

```sh
npm run build
```

خروجی در `site/dist/` قرار می‌گیرد و commit نمی‌شود. هر دو فرمان پیش از اجرا،
assetهای گام‌ها و خروجی بازی‌ها را در staging موقت Astro آماده می‌کنند.

برای شبیه‌سازی GitHub project pages به‌صورت محلی:

```sh
BASE_PATH=/rasta-internet-workshop SITE_URL=https://example.github.io npm run build
```

## GitHub Actions

دو workflow مستقل وجود دارد:

- `.github/workflows/deploy.yml` با هر push به `main`، فقط آخرین محتوای commit‌شده
  را test و build می‌کند و روی GitHub Pages منتشر می‌کند. این workflow به Google
  Docs یا secretهای OAuth دسترسی ندارد.
- `.github/workflows/import-steps.yml` فقط از منوی Actions و به‌صورت دستی اجرا
  می‌شود. Google Doc را import می‌کند، test و build را روی خروجی تازه اجرا می‌کند
  و اگر `steps/` تغییر کرده باشد آن را با پیام
  `content: import steps from Google Docs` در `main` commit و push می‌کند. سپس
  workflow انتشار را صریحاً برای آخرین commit شاخهٔ `main` اجرا می‌کند.

اجرای صریح workflow انتشار لازم است چون push انجام‌شده با `GITHUB_TOKEN` به‌طور
خودکار workflow دیگری را با رویداد `push` راه نمی‌اندازد. pushهای معمولی اعضای
تیم به `main` همچنان مستقیماً workflow انتشار را اجرا می‌کنند.

این دو secret را در تنظیمات مخزن تعریف کنید:

- `GOOGLE_OAUTH_CLIENT_JSON`: کل محتوای فایل `google-oauth-client.json`
- `GOOGLE_REFRESH_TOKEN`: فقط مقدار refresh token، بدون عنوان یا پیشوند

فقط workflow دستی importer از این secretها استفاده می‌کند. همان importer و build
command در محیط محلی و GitHub Actions اجرا می‌شوند و importer در هر اجرا access
token تازه می‌گیرد. اگر شاخهٔ `main` با branch protection جلوی push مستقیم را
بگیرد، باید به این workflow اجازهٔ مناسب داده شود یا فرایند import به ساخت pull
request تغییر کند.

## پیشنهاد متن با کمک Codex

پیشنهاد محتوای یک گام در فایل زیر نوشته می‌شود:

```text
temp/<step-name>.md
```

پوشهٔ `temp/` در Git نادیده گرفته می‌شود. اپراتور انسانی متن موردنظر را به Google
Docs منتقل می‌کند.
