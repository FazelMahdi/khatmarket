import { Suspense } from "react";
import { Skeleton } from "@heroui/react";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="mt-8 h-64 w-full rounded-3xl" />}>{children}</Suspense>
  );
}
