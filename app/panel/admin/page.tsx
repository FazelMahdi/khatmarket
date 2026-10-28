import { Card, Chip } from "@heroui/react";
import { ImportForm } from "@/components/import-form";
import { prisma } from "@/lib/db";

const fmt = new Intl.NumberFormat("fa-IR");
const dateFmt = new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" });

export default async function Admin() {
  const [users, listings, priced, lookups, recent, runs] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { price: { not: null }, active: true } }),
    prisma.lookup.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
  ]);
  const stats = [["کاربران", users], ["آگهی‌ها", listings], ["آگهی قیمت‌دار", priced], ["استعلام‌ها", lookups]] as const;
  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold">مدیریت</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <Card key={k}>
            <Card.Content>
              <p className="text-sm text-muted">{k}</p>
              <p className="text-2xl font-extrabold">{fmt.format(v)}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
      <Card>
        <Card.Header>
          <Card.Title>همگام‌سازی ساعتی با rond.ir</Card.Title>
          <Card.Description>با `npm run rond:sync` روی سرور اجرا می‌شود.</Card.Description>
        </Card.Header>
        <Card.Content>
          {runs.length === 0 ? (
            <p className="text-sm text-muted">هنوز اجرایی ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-separator text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="digits">{dateFmt.format(r.startedAt)}</span>
                  <Chip size="sm" variant="soft" color={r.status === "ok" ? "success" : r.status === "failed" ? "danger" : "warning"}>
                    {r.status === "ok" ? "موفق" : r.status === "failed" ? "ناموفق" : "در حال اجرا"}
                  </Chip>
                  <span className="text-muted">
                    {fmt.format(r.seen)} آگهی · {fmt.format(r.deactivated)} حذف‌شده{r.withLabels ? " · برچسب‌ها" : ""}
                  </span>
                  {r.error && <span className="w-full truncate text-xs text-danger">{r.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
      <Card>
        <Card.Header><Card.Title>وارد کردن آگهی‌ها از rond.ir</Card.Title></Card.Header>
        <Card.Content><ImportForm /></Card.Content>
      </Card>
      <Card>
        <Card.Header><Card.Title>آخرین کاربران</Card.Title></Card.Header>
        <Card.Content>
          <ul className="divide-y divide-separator text-sm">
            {recent.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span className="digits">{u.username}</span>
                <Chip size="sm" color={u.role === "ADMIN" ? "accent" : "default"} variant="soft">{u.role}</Chip>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
