# راه‌اندازی API مینی‌گیم‌های مدل پایه و مدل گفتگو

این Worker درخواست مرورگر را به Gemini 3.5 Flash-Lite می‌فرستد و دو رفتار آموزشی متفاوت را ارائه می‌کند:

- مسیر `/generate` رفتار تکمیل متن یک مدل پایه را شبیه‌سازی می‌کند.
- مسیر `/generate-sft` رفتار یک مدل گفت‌وگومحور و دستورپذیر را شبیه‌سازی می‌کند.
- مسیر `/generate-aligned` رفتار یک دستیار کمک‌کننده، صادق و ایمن را شبیه‌سازی می‌کند.

کلید Gemini فقط در Secretهای Worker نگهداری می‌شود و هرگز به مرورگر فرستاده نمی‌شود.

هر درخواست کاملاً مستقل است. Worker فقط آخرین پیام را ارسال می‌کند و تاریخچه گفت‌وگوی کاربر را در اختیار مدل قرار نمی‌دهد. در مسیر مدل پایه، چند نمونه ثابت صرفاً برای تثبیت رفتار تکمیل متن همراه درخواست ارسال می‌شوند.

برای اینکه آزمون درخواست‌های خطرناک در کارگاه به ارائه جزئیات عملی منجر نشود، چند الگوی پرخطر در مسیر `/generate-sft` به پاسخ‌های ازپیش‌تعیین‌شده و سانسورشده تبدیل می‌شوند. تنظیمات ایمنی Gemini نیز در حالت پیش‌فرض باقی مانده‌اند.

## ۱. گرفتن کلید Gemini

1. وارد [Google AI Studio](https://aistudio.google.com/) شوید.
2. بخش API Keys را باز کنید.
3. یک API key جدید بسازید و آن را کپی کنید.

کلید را داخل GitHub، فایل `config.js` یا کد Worker قرار ندهید.

## ۲. اجرای محلی Worker

داخل پوشه `pretrained-llm-worker` اجرا کنید:

```bash
npm install
cp .dev.vars.example .dev.vars
```

در ویندوز می‌توانید به‌جای دستور `cp`، فایل `.dev.vars.example` را کپی و نام نسخه جدید را `.dev.vars` بگذارید. سپس کلید واقعی را فقط در `.dev.vars` وارد کنید و اجرا کنید:

```bash
npm run dev
```

برای تست فرانت‌اند محلی، در `pretrained-llm/config.js` بنویسید:

```js
window.PRETRAINED_MODEL_API_URL = "http://localhost:8787/generate";
```

برای تست رابط مدل گفتگو، در `sft-llm/config.js` از این مسیر استفاده کنید:

```js
window.PRETRAINED_MODEL_API_URL = "http://localhost:8787/generate-sft";
```

برای تست رابط مرحله بعد، در `rlhf-llm/config.js` از این مسیر استفاده کنید:

```js
window.PRETRAINED_MODEL_API_URL = "http://localhost:8787/generate-aligned";
```

## ۳. انتشار Worker

برای اولین انتشار، ابتدا فایل Secret محلی را بسازید:

```bash
npx wrangler login
cp .dev.vars.example .dev.vars
```

در ویندوز می‌توانید فایل را با این دستور باز کنید:

```bash
notepad.exe .dev.vars
```

مقدار داخل فایل را با کلید جدید Google AI Studio جایگزین کنید و سپس اولین انتشار را انجام دهید:

```bash
npm run deploy:first
```

فایل `.dev.vars` در git نادیده گرفته می‌شود و نباید commit شود. پس از ساخته‌شدن Worker، برای تغییر کلید می‌توانید از `npx wrangler secret put GEMINI_API_KEY` و برای انتشارهای بعدی از `npm run deploy` استفاده کنید.

در پایان URL منتشرشده را با مسیر `/generate` در `pretrained-llm/config.js` بگذارید، مثلاً:

```js
window.PRETRAINED_MODEL_API_URL = "https://pretrained-llm-proxy.example.workers.dev/generate";
```

همین نشانی را با مسیر `/generate-sft` در `sft-llm/config.js` قرار دهید:

```js
window.PRETRAINED_MODEL_API_URL = "https://pretrained-llm-proxy.example.workers.dev/generate-sft";
```

در `rlhf-llm/config.js` نیز مسیر `/generate-aligned` را قرار دهید:

```js
window.PRETRAINED_MODEL_API_URL = "https://pretrained-llm-proxy.example.workers.dev/generate-aligned";
```

مینی‌گیم نهایی `model-lab` هر چهار حالت را در یک رابط نمایش می‌دهد. در فایل `model-lab/config.js` فقط نشانی اصلی Worker را بدون مسیر پایانی قرار دهید:

```js
window.MODEL_API_ROOT = "https://pretrained-llm-proxy.example.workers.dev";
```

مدل خام در خود مرورگر اجرا می‌شود و سه مدل دیگر به‌ترتیب از مسیرهای `/generate`، `/generate-sft` و `/generate-aligned` استفاده می‌کنند. تاریخچه هر تب فقط برای نمایش در مرورگر نگه داشته می‌شود و همراه درخواست API ارسال نمی‌شود.

سپس فایل‌های پروژه را commit و push کنید. تا وقتی URL تنظیم نشده یا endpoint در دسترس نیست، فرانت‌اند خودکار از تکمیل‌کننده محلی استفاده می‌کند.

## نکته‌های اجرایی کارگاه

- محدودیت پیش‌فرض هر مرورگر برابر ۲۰ درخواست در دقیقه است تا بچه‌هایی که روی یک شبکه‌اند مزاحم یکدیگر نشوند.
- طول ورودی در مرورگر و Worker به ۶۰۰ نویسه محدود شده است.
- خروجی مدل پایه حداکثر ۱۲۰ توکن و خروجی مدل‌های گفت‌وگویی حداکثر ۵۱۲ توکن دارد.
- تنظیمات ایمنی پیش‌فرض Gemini تغییر داده نشده‌اند.
- در Free Tier، داده‌های ارسالی ممکن است برای بهبود محصولات گوگل استفاده شوند؛ از واردکردن اطلاعات شخصی یا حساس خودداری کنید.
