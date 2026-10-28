# قیمت‌یاب شماره رند

Next.js (App Router) + HeroUI v3 + Prisma/PostgreSQL. شماره موبایل را وارد می‌کنید، الگوهای رند آن تشخیص داده می‌شود و بر اساس آگهی‌های مشابه (rond.ir) قیمت تقریبی برآورد می‌شود.

## Run
```bash
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET, ADMIN_*
npm install
npx prisma migrate deploy
npm run seed                # admin user + 40 sample listings
npm run dev
```

- ثبت‌نام آزاد با نام کاربری/رمز عبور (بدون OTP)، نقش‌ها: `ADMIN` / `USER`. مسیرهای `/panel/**` با `proxy.ts` محافظت می‌شوند.
- الگوها: `lib/numbers/patterns.ts` (۳۹ الگوریتم rond.ir؛ تفسیرها تقریبی‌اند و «حروفی»، «گفتاری» هنوز پیاده نشده‌اند).
- برآورد: `lib/numbers/estimate.ts` (شباهت ساختاری + میانه وزنی).

## Data
- `/panel/admin`: JSON صفحات rond.ir را paste کنید، یا `ROND_COOKIE=... npx tsx scripts/ingest-rond.ts 0912` (نیاز به دسترسی شبکه به rond.ir).
- فقط ۴۰ آگهی نمونه (VIP، پیش‌شماره 0912) تاکنون وارد شده؛ دقت برآورد با داده بیشتر بالا می‌رود.

## Test
`npm test`
