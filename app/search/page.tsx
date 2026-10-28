import { Suspense } from "react";
import { DigitSearch } from "@/components/digit-search";

export default function SearchPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 py-10">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">جستجوی خانه‌ای</h1>
        <p className="mt-2 text-sm text-muted">
          مثل فیلتر شماره در rond.ir: رقم‌هایی که برایت مهم است را بنویس، بقیه را خالی بگذار.
        </p>
      </div>
      <Suspense>
        <DigitSearch />
      </Suspense>
    </section>
  );
}
