"use client";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      خروج
    </Button>
  );
}
