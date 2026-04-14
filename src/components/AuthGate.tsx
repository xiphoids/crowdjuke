"use client";

import { useEffect } from "react";
import db from "@/lib/db";
import LoadingSpinner from "./LoadingSpinner";

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
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}
