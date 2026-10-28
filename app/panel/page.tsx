import { Card } from "@heroui/react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { Estimate } from "@/lib/numbers/estimate";

const fmt = new Intl.NumberFormat("fa-IR");

export default async function Panel() {
  const session = (await getSession())!;
  const lookups = await prisma.lookup.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">سلام، {session.username}</h1>
        <p className="text-sm text-muted">تاریخچه استعلام‌های شما</p>
      </div>
      <Card>
        <Card.Content>
          {lookups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">هنوز استعلامی انجام نداده‌اید.</p>
          ) : (
            <ul className="divide-y divide-separator">
              {lookups.map((l) => {
                const r = l.result as unknown as Estimate;
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="digits font-medium">{l.number}</span>
                    <span className="text-muted">{r.primary?.label}</span>
                    <span>{r.price ? `${fmt.format(r.price.mid)} تومان` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
