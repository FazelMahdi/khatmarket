# قیمت‌یاب شماره رند

Next.js (App Router) + HeroUI v3 + Prisma/PostgreSQL. شماره موبایل را وارد می‌کنید، الگوهای رند آن تشخیص داده می‌شود و بر اساس آگهی‌های مشابه (rond.ir) قیمت تقریبی برآورد می‌شود.

## اجرا روی سیستم خودتان
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

- ثبت‌نام آزاد با نام کاربری/رمز عبور (بدون OTP)، نقش‌ها: `ADMIN` / `USER`. مسیرهای `/panel/**` با `proxy.ts` محافظت می‌شوند.
- الگوها: `lib/numbers/patterns.ts` (۳۹ الگوریتم rond.ir؛ تفسیرها تقریبی‌اند و «حروفی»، «گفتاری» هنوز پیاده نشده‌اند).
- برآورد: `lib/numbers/estimate.ts` (شباهت ساختاری + میانهٔ وزنی).

## داده
- `/panel/admin`: JSON صفحات rond.ir را paste کنید، یا `ROND_COOKIE=... npx tsx scripts/ingest-rond.ts 0912` (نیاز به دسترسی شبکه به rond.ir).
- فعلاً فقط ۴۰ آگهی نمونه (VIP، پیش‌شمارهٔ 0912) هست؛ دقت برآورد با داده بیشتر بالا می‌رود.

## تست
`npm test`
