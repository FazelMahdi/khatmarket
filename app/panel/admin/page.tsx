import { Card, Chip } from "@heroui/react";
import { ImportForm } from "@/components/import-form";
import { prisma } from "@/lib/db";

const fmt = new Intl.NumberFormat("fa-IR");

export default async function Admin() {
  const [users, listings, priced, lookups, recent] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { price: { not: null } } }),
    prisma.lookup.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
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
