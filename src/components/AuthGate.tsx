"use client";

import { useEffect } from "react";
import db from "@/lib/db";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, user, error } = db.useAuth();

  useEffect(() => {
    if (!isLoading && !user && !error) {
      db.auth.signInAsGuest();
    }
  }, [isLoading, user, error]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <p className="animate-pulse text-text-muted text-lg">Loading&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
}
