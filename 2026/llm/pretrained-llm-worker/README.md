# راه‌اندازی API مدل پایه

این Worker درخواست مرورگر را بدون هیچ قالب چت یا system prompt مستقیماً برای مدل تکمیل متن می‌فرستد. کلید Hugging Face فقط در Secretهای Worker نگهداری می‌شود.

## ۱. ساخت endpoint مدل

در Hugging Face یک Inference Endpoint برای مدل `HooshvareLab/gpt2-fa` بسازید و Task را روی Text Generation بگذارید. پس از آماده‌شدن، URL endpoint و یک Access Token با حداقل دسترسی لازم را بردارید.

## ۲. اجرای محلی Worker

داخل پوشه `pretrained-llm-worker` اجرا کنید:

```bash
npm install
cp .dev.vars.example .dev.vars
```

مقادیر واقعی را فقط در `.dev.vars` بگذارید. این فایل در git نادیده گرفته می‌شود. سپس:

```bash
npm run dev
```

برای تست فرانت‌اند محلی، در `pretrained-llm/config.js` بنویسید:

```js
window.PRETRAINED_MODEL_API_URL = "http://localhost:8787/generate";
```

## ۳. انتشار Worker

```bash
npx wrangler login
npx wrangler secret put HF_ENDPOINT_URL
npx wrangler secret put HF_TOKEN
npm run deploy
```

هر مقدار را وقتی Wrangler درخواست کرد وارد کنید. کلید را داخل کد، GitHub یا `config.js` قرار ندهید.

در پایان URL منتشرشده را با مسیر `/generate` در `pretrained-llm/config.js` بگذارید، مثلاً:

```js
window.PRETRAINED_MODEL_API_URL = "https://pretrained-llm-proxy.example.workers.dev/generate";
```

سپس فایل‌های پروژه را commit و push کنید. تا وقتی URL تنظیم نشده یا endpoint در دسترس نیست، فرانت‌اند خودکار از تکمیل‌کننده محلی استفاده می‌کند.

## نکته‌های اجرایی کارگاه

- محدودیت پیش‌فرض هر مرورگر برابر ۲۰ درخواست در دقیقه است تا بچه‌هایی که روی یک شبکه‌اند مزاحم یکدیگر نشوند.
- طول ورودی در مرورگر و Worker به ۶۰۰ نویسه محدود شده است.
- خروجی هر درخواست حداکثر ۷۲ توکن جدید دارد.
- بهتر است endpoint را چند دقیقه پیش از شروع کارگاه روشن و با چند ورودی فارسی امتحان کنید.
