"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setFailed(false);
    try {
      await signOut();
      router.replace("/auth/start");
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <Button
      className="justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground lg:w-full"
      disabled={pending}
      onClick={handleSignOut}
      size="sm"
      variant="ghost"
    >
      <LogOut aria-hidden="true" size={16} strokeWidth={1.7} />
      {pending ? "Signing out…" : failed ? "Try signing out again" : "Sign out"}
    </Button>
  );
}
