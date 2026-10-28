import { Estimator } from "@/components/estimator";

export default function Home() {
  return (
    <div className="bg-hero -mx-4 px-4 sm:-mx-6 sm:px-6">
      <section className="mx-auto flex max-w-2xl flex-col gap-8 py-12 sm:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">شماره‌ات چقدر می‌ارزد؟</h1>
          <p className="mt-4 text-muted">
            شماره موبایل را وارد کن؛ الگوی رند آن را تشخیص می‌دهیم و با آگهی‌های مشابه بازار مقایسه می‌کنیم.
          </p>
        </div>
        <Estimator />
      </section>
    </div>
  );
}
