import Link from "next/link";
import { Hash } from "lucide-react";
import { getSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

const linkCls =
  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-foreground/80 transition hover:bg-default hover:text-foreground";

export async function Navbar() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b border-separator bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Hash size={18} />
          </span>
          <span className="hidden sm:inline">قیمت‌یاب رند</span>
        </Link>
        <nav className="flex items-center gap-1">
          {session ? (
            <>
              <Link href="/panel" className={linkCls}>پنل</Link>
              {session.role === "ADMIN" && <Link href="/panel/admin" className={linkCls}>مدیریت</Link>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={linkCls}>ورود</Link>
              <Link href="/register" className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground">
                ثبت‌نام
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
