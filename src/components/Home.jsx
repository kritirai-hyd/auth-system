"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Avoid redirecting while session is loading

    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role.toLowerCase();
      router.replace(role === "manager" ? "/manager" : "/user");
    }
  }, [status, session, router]);

  return null; // This component only handles redirect logic
}
