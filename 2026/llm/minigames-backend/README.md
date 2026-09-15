# API مشترک مینی‌گیم‌های مدل

این Worker تنها مرز مرورگر با دروازهٔ مدل است. کد مرورگر فقط باید Worker عمومی
را صدا بزند؛ کلید، هدر احراز هویت و نشانی ارائه‌دهنده هرگز در مرورگر قرار
نمی‌گیرد. قرارداد اصلی جدید `/api/respond` با پاسخ `{ok, data, meta, error}`
است؛ مسیرهای قدیمی فقط برای سازگاری نگه داشته شده‌اند.

این Worker چند رفتار آموزشی متفاوت را از طریق دروازهٔ OpenAI-compatible ارائه می‌کند:

- مسیر `/generate` رفتار تکمیل متن یک مدل پایه را شبیه‌سازی می‌کند.
- مسیر `/generate-sft` رفتار یک مدل گفت‌وگومحور و دستورپذیر را شبیه‌سازی می‌کند.
- مسیر `/generate-aligned` رفتار یک دستیار کمک‌کننده، صادق و ایمن را شبیه‌سازی می‌کند.

اعتبار دروازه فقط در Secret محیط Worker با نام `LLM_API_KEY` نگهداری می‌شود و هرگز به مرورگر فرستاده نمی‌شود.

هر درخواست کاملاً مستقل است. Worker فقط آخرین پیام را ارسال می‌کند و تاریخچه گفت‌وگوی کاربر را در اختیار مدل قرار نمی‌دهد. در مسیر مدل پایه، چند نمونه ثابت صرفاً برای تثبیت رفتار تکمیل متن همراه درخواست ارسال می‌شوند.

برای اینکه آزمون درخواست‌های خطرناک در کارگاه به ارائه جزئیات عملی منجر نشود، چند الگوی پرخطر در مسیر `/generate-sft` به پاسخ‌های ازپیش‌تعیین‌شده و سانسورشده تبدیل می‌شوند. تنظیمات ایمنی Gemini نیز در حالت پیش‌فرض باقی مانده‌اند.

## ۱. تنظیم Secret Worker

نام فعال Secret `LLM_API_KEY` است؛ از `GEMINI_API_KEY` یا کلیدهای provider در
بازی‌ها و مستندات جدید استفاده نکنید. upstream فقط سمت Worker احراز هویت می‌شود.

1. Secret دروازهٔ مورد استفادهٔ Worker را فقط در محیط deployment تهیه کنید.
2. آن را با `npx wrangler secret put LLM_API_KEY` تنظیم کنید.

کلید را داخل GitHub، فایل `config.js` یا کد Worker قرار ندهید.

## ۲. اجرای محلی Worker

داخل پوشه `minigames-backend` اجرا کنید:

```bash
npm ci
npm run check
```

در ویندوز می‌توانید به‌جای دستور `cp`، فایل `.dev.vars.example` را کپی و نام نسخه جدید را `.dev.vars` بگذارید. سپس کلید واقعی را فقط در `.dev.vars` وارد کنید و اجرا کنید:

```bash
npm run dev
```

برای تست فرانت‌اند محلی، در `pretrained-llm/config.js` بنویسید:

```js
window.PRETRAINED_MODEL_API_URL = 'http://localhost:8787/generate';
```

برای تست رابط مدل گفتگو، در `sft-llm/config.js` از این مسیر استفاده کنید:

```js
window.PRETRAINED_MODEL_API_URL = 'http://localhost:8787/generate-sft';
```

برای تست رابط مرحله بعد، در `rlhf-llm/config.js` از این مسیر استفاده کنید:

```js
window.PRETRAINED_MODEL_API_URL = 'http://localhost:8787/generate-aligned';
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

فایل `.dev.vars` در git نادیده گرفته می‌شود و نباید commit شود. پس از ساخته‌شدن Worker، برای تغییر کلید از `npx wrangler secret put LLM_API_KEY` و برای انتشارهای بعدی از `npm run deploy` استفاده کنید.

در پایان URL منتشرشده را با مسیر `/generate` در `pretrained-llm/config.js` بگذارید، مثلاً:

```js
window.PRETRAINED_MODEL_API_URL =
  'https://pretrained-llm-proxy.example.workers.dev/generate';
```

همین نشانی را با مسیر `/generate-sft` در `sft-llm/config.js` قرار دهید:

```js
window.PRETRAINED_MODEL_API_URL =
  'https://pretrained-llm-proxy.example.workers.dev/generate-sft';
```

در `rlhf-llm/config.js` نیز مسیر `/generate-aligned` را قرار دهید:

```js
window.PRETRAINED_MODEL_API_URL =
  'https://pretrained-llm-proxy.example.workers.dev/generate-aligned';
```

مینی‌گیم نهایی `model-lab` سه حالت (مدل خام، مدل پایه و مدل گفتگو) را در یک رابط نمایش می‌دهد. در فایل `model-lab/config.js` فقط نشانی اصلی Worker را بدون مسیر پایانی قرار دهید:

```js
window.MODEL_API_ROOT = 'https://pretrained-llm-proxy.example.workers.dev';
```

مدل خام در خود مرورگر اجرا می‌شود و دو مدل دیگر به‌ترتیب از مسیرهای `/generate` و `/generate-sft` استفاده می‌کنند. تاریخچه هر تب فقط برای نمایش در مرورگر نگه داشته می‌شود و همراه درخواست API ارسال نمی‌شود.

سپس فایل‌های پروژه را commit و push کنید. تا وقتی URL تنظیم نشده یا endpoint در دسترس نیست، فرانت‌اند خودکار از تکمیل‌کننده محلی استفاده می‌کند.

## نکته‌های اجرایی کارگاه

- محدودیت پیش‌فرض هر مرورگر برابر ۲۰ درخواست در دقیقه است تا بچه‌هایی که روی یک شبکه‌اند مزاحم یکدیگر نشوند.
- طول ورودی در مرورگر و Worker به ۶۰۰ نویسه محدود شده است.
- خروجی مدل پایه حداکثر ۱۲۰ توکن و خروجی مدل‌های گفت‌وگویی حداکثر ۵۱۲ توکن دارد.
- تنظیمات ایمنی پیش‌فرض Gemini تغییر داده نشده‌اند.
- در Free Tier، داده‌های ارسالی ممکن است برای بهبود محصولات گوگل استفاده شوند؛ از واردکردن اطلاعات شخصی یا حساس خودداری کنید.
