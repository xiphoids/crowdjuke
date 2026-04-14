"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import type { EventRow } from "./types";
import { shareOrCopy } from "./shareOrCopy";
import { useShareUrl } from "./useShareUrl";

export default function EventHeader({ event }: { event: EventRow }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [showQr, setShowQr] = useState(false);
  const shareUrl = useShareUrl(event.joinCode);

  const share = useCallback(
    async (kind: "code" | "link") => {
      const payload =
        kind === "link"
          ? { title: "Join my CrowdJuke", url: shareUrl }
          : { title: "Join my CrowdJuke", text: event.joinCode };
      const clipText = kind === "link" ? shareUrl : event.joinCode;

      const result = await shareOrCopy(payload, clipText);
      if (result === "copied") {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      }
    },
    [shareUrl, event.joinCode],
  );

  const btnCls =
    "rounded-md px-2.5 py-1 text-xs font-medium text-ui-cyan ring-1 ring-ui-cyan/30 transition hover:bg-ui-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60";

  return (
    <header className="mb-8">
      <Link
        href="/"
        className="text-sm text-text-muted transition hover:text-ui-cyan"
      >
        &larr; Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-text-primary">{event.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-canvas-elevated px-3 py-1 font-mono text-sm tracking-widest text-text-primary">
          {event.joinCode}
        </span>
        <button onClick={() => share("code")} className={btnCls}>
          {copied === "code" ? "Copied!" : "Copy Code"}
        </button>
        <button onClick={() => share("link")} className={btnCls}>
          {copied === "link" ? "Copied!" : "Copy Link"}
        </button>
        <button onClick={() => setShowQr((v) => !v)} className={btnCls}>
          {showQr ? "Hide QR" : "Show QR"}
        </button>
      </div>

      {showQr && shareUrl && (
        <div className="mt-4 inline-block rounded-xl bg-white p-3">
          <QRCode value={shareUrl} size={160} />
        </div>
      )}
    </header>
  );
}
