# قیمت‌یاب شماره رند

Next.js (App Router) + HeroUI v3 + Prisma/PostgreSQL. شماره موبایل را وارد می‌کنید و قیمت تقریبی را مثل یک قیمت‌گذار واقعی پیدا می‌کند: رقم‌هایی که شماره را رند می‌کنند نگه می‌دارد، بقیه را خالی می‌گذارد (مثلاً برای 09121003088 جستجوی `0912-00-0`) و قیمت آگهی‌های همان الگو را می‌خواند.

## ۱. اجرا روی سیستم خودتان
نیاز: Node 22 و Docker (یا یک PostgreSQL دلخواه).
```bash
docker compose up -d            # PostgreSQL روی پورت 5432 (کاربر/رمز/دیتابیس: rond)
cp .env.example .env            # سپس مقادیر را تنظیم کنید (پایین را ببینید)
npm install
npx prisma migrate deploy
npm run seed                    # کاربر ادمین + ۴۰ آگهی نمونه
npm run dev                     # http://localhost:3000
```
مقادیر نمونه برای `.env` با docker-compose بالا:
```
DATABASE_URL="postgresql://rond:rond@localhost:5432/rond"
AUTH_SECRET="هر رشتهٔ تصادفی حداقل ۱۶ کاراکتر"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="یک رمز دلخواه"
```

## ۲. جمع‌آوری داده از rond.ir و یادگیری فرمول
این مرحله روی سیستم خودتان اجرا می‌شود (باید rond.ir در دسترس باشد):
```bash
npm run rond:discover   # کد سایت rond.ir را می‌خواند و فیلد فیلتر «نوع رند» را پیدا و تست می‌کند -> data/rond-api.json
npm run rond:collect    # همهٔ آگهی‌های پیش‌شماره‌های همراه اول + برچسب ۴۲ نوع رند (قابل ادامه بعد از قطع شدن)
npm run rond:learn      # دقت تشخیص الگوها، ضریب پیش‌شماره و وضعیت سیم، و بک‌تست خطا -> data/model.json
```
- فقط یک پیش‌شماره: `npm run rond:collect -- --precodes=0912`
- سرعت: `--delay=400` (میلی‌ثانیه بین درخواست‌ها)، `--size=100`، شروع از اول: `--fresh`
- اگر سایت کوکی خواست: `ROND_COOKIE="..." npm run rond:collect` (کوکی را در فایل‌ها ذخیره نکنید)
- اگر `rond:discover` فیلد نوع رند را پیدا نکرد: فایل `data/rond-api.json` را بفرستید، یا دستی `ROND_ALGO_FIELD=<نام فیلد>` بدهید.
- بعد از `rond:learn` فایل `data/learn-report.json` را بفرستید تا تشخیص الگوهایی که با rond.ir نمی‌خوانند اصلاح شود.

## صفحه‌ها
- `/` برآورد قیمت: الگوها، «جستجوی معادل» (مثل `0912-00-0`)، بازهٔ قیمت و آگهی‌های همان الگو.
- `/search` جستجوی خانه‌ای مثل فیلتر شمارهٔ rond.ir (خانهٔ خالی = هر رقمی).
- `/panel` تاریخچهٔ استعلام‌ها، `/panel/admin` آمار و وارد کردن دستی JSON.
- ثبت‌نام آزاد با نام کاربری/رمز عبور (بدون OTP)، نقش‌ها: `ADMIN` / `USER`.

## کد
- `lib/numbers/mask.ts` ساخت جستجوهای خانه‌ای از رقم‌های رند
- `lib/numbers/estimate.ts` قیمت از دقیق‌ترین جستجویی که آگهی کافی دارد (میانهٔ پیراسته، ضریب پیش‌شماره و وضعیت)
- `lib/numbers/patterns.ts` و `lib/numbers/algorithms.ts` الگوهای rond.ir با شناسه‌های واقعی‌شان
- `scripts/rond-*.ts` جمع‌آوری و یادگیری

## تست
`npm test`
