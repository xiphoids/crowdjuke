"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import db from "@/lib/db";
import type { EventRow } from "./types";
import EventHeader from "./EventHeader";
import AddSongForm from "./AddSongForm";
import SongQueue from "./SongQueue";

export default function EventRoom({
  code,
  initialShareUrl,
}: {
  code: string;
  initialShareUrl?: string;
}) {
  const user = db.useUser();

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  const onSongAdded = useCallback((ids: string[]) => {
    setHighlightIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clearHighlight = useCallback((id: string) => {
    setHighlightIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const { isLoading, error, data } = db.useQuery({
    events: {
      $: { where: { joinCode: code } },
      songRequests: { votes: {} },
      memberships: { $: { where: { userId: user.id } } },
    },
  });

  const event = (data?.events as unknown as EventRow[] | undefined)?.[0];

  // Auto-join when the user first visits an event they're not a member of.
  const joined = useRef(false);
  useEffect(() => {
    if (!event || joined.current) return;
    if (event.memberships.length > 0) return;
    joined.current = true;

    db.transact(
      db.tx.memberships
        .lookup("lookupKey", `${event.id}:${user.id}`)
        .update({
          userId: user.id,
          createdAt: Date.now(),
        })
        .link({ event: event.id }),
    );
  }, [event, user.id]);

  // Persist the current event code so native share extensions can default to it.
  useEffect(() => {
    try {
      localStorage.setItem("crowdjuke:lastEventCode", code);
    } catch {}
    import("@capacitor/preferences")
      .then(({ Preferences }) =>
        Preferences.set({ key: "lastEventCode", value: code }),
      )
      .catch(() => {});
  }, [code]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-text-muted text-lg">
          Loading event&hellip;
        </p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-medium text-text-primary">
          {error ? "Something went wrong." : "Event not found."}
        </p>
        <p className="text-sm text-text-muted">
          Double-check your event code and try again.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg border border-ui-cyan/40 bg-ui-cyan/10 px-4 py-2 text-sm font-semibold text-ui-cyan transition hover:bg-ui-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4">
      <div className="pt-4 sm:pt-8">
        <EventHeader event={event} />
      </div>
      <div className="sticky top-0 z-20 -mx-4 bg-canvas px-4 pb-4 pt-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)]">
        <AddSongForm
          eventId={event.id}
          userId={user.id}
          initialShareUrl={initialShareUrl}
          existingSongs={event.songRequests}
          showToast={showToast}
          onSongAdded={onSongAdded}
          queueEmpty={event.songRequests.length === 0}
        />
      </div>
      <div className="pb-8 pt-4">
        <SongQueue songs={event.songRequests} userId={user.id} isHost={user.id === event.creatorId} creatorId={event.creatorId} highlightIds={highlightIds} clearHighlight={clearHighlight} joinCode={event.joinCode} />
      </div>

      <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {toast && (
          <div className="flex items-center gap-2 animate-fade-in rounded-lg border border-ui-cyan/20 bg-canvas-elevated px-4 py-2.5 text-sm font-medium text-ui-cyan shadow-lg shadow-black/30">
            <span>{toast}</span>
            <button
              onClick={() => { clearTimeout(toastTimer.current); setToast(null); }}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-ui-cyan/50 transition hover:text-ui-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
