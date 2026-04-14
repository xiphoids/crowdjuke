"use client";

import { useEffect, useState } from "react";

export function useShareUrl(joinCode: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setUrl(`${base}/event/${joinCode}`);
  }, [joinCode]);
  return url;
}
