"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { generateJoinCode, normalizeCode } from "@/lib/joinCode";
import { cn } from "@/lib/cn";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center">
      {/* Landing Hero */}
      <section className="w-full bg-landing-bg">
        <div className="mx-auto max-w-2xl px-4 pt-16 text-center md:pt-24">
          <h1 className="text-5xl font-extrabold tracking-wide text-landing-ink md:text-6xl">
            CROWD JUKE
          </h1>
          <p className="mt-3 text-lg text-landing-muted">
            When Ballots Drop, Bangers Don&apos;t Stop.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => document.getElementById("event-name")?.focus()}
              className="rounded-full bg-gradient-to-r from-neon-orange to-brand-gold px-6 py-2.5 text-sm font-bold text-canvas shadow-md shadow-neon-orange/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg"
            >
              Host Event
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("join-code")?.focus()}
              className="rounded-full border border-neon-orange/40 bg-landing-bg px-6 py-2.5 text-sm font-bold text-landing-ink transition hover:bg-neon-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg"
            >
              Join Event
            </button>
          </div>

          <div className="mt-10 grid w-full gap-8 text-left md:grid-cols-2">
            <CreateEventForm />
            <JoinEventForm />
          </div>
        </div>

        <Image
          src="/jukebox-hero.png"
          alt="CrowdJuke — neon jukebox with crowd voting"
          width={682}
          height={1024}
          priority
          className="mx-auto mt-10 h-64 w-auto object-contain md:h-80"
        />
      </section>

      {/* Hero → dark transition */}
      <div className="w-full bg-landing-bg" aria-hidden="true">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="block h-[60px] w-full md:h-[80px]"
        >
          <path
            d="M0,60 C360,120 1080,0 1440,60 L1440,120 L0,120 Z"
            className="fill-canvas"
          />
        </svg>
      </div>

      {/* How It Works */}
      <section className="mt-10 w-full max-w-4xl px-4">
        <h2 className="mb-10 text-center text-2xl font-bold">
          How It <span className="text-ui-cyan">Works</span>
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: "📲", title: "Scan or Enter Code", desc: "The host shares a code or QR. Guests join in seconds — no app needed." },
            { icon: "🗳️", title: "Vote a Song", desc: "Browse the queue and upvote your favorites. Every voice counts." },
            { icon: "🎵", title: "Play the Winner", desc: "Top-voted track plays next. The crowd decides the vibe." },
          ].map((step) => (
            <div key={step.title} className="flex flex-col items-center rounded-xl bg-canvas-elevated/60 p-6 text-center">
              <span className="text-4xl">{step.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Event Types */}
      <section className="mt-24 w-full max-w-4xl px-4">
        <h2 className="mb-10 text-center text-2xl font-bold">
          Built for <span className="text-brand-gold">Every</span> Event
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <EventTypeCard
            title="Weddings"
            emoji="💒"
            desc="Let your guests pick the reception bangers."
            accent="border-action-red/30"
            rows={[
              { song: "September", artist: "Earth, Wind & Fire", pct: 72 },
              { song: "Uptown Funk", artist: "Bruno Mars", pct: 58 },
            ]}
          />
          <EventTypeCard
            title="Game Day"
            emoji="🏟️"
            desc="Tailgates and halftime — fans vote, the stadium rocks."
            accent="border-brand-gold/30"
            rows={[
              { song: "We Will Rock You", artist: "Queen", pct: 81 },
              { song: "Thunderstruck", artist: "AC/DC", pct: 64 },
            ]}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-24 w-full border-t border-white/10 py-10 text-center text-sm text-text-muted">
        <p className="font-semibold text-text-primary/70">Powered by Crowd Power</p>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <span>About</span>
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </div>
        <p className="mt-4">&copy; {new Date().getFullYear()} CrowdJuke</p>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function EventTypeCard({
  title,
  emoji,
  desc,
  accent,
  rows,
}: {
  title: string;
  emoji: string;
  desc: string;
  accent: string;
  rows: { song: string; artist: string; pct: number }[];
}) {
  return (
    <div className={cn("rounded-2xl border bg-canvas-elevated/80 p-6", accent)}>
      <h3 className="text-xl font-semibold">
        {emoji} {title}
      </h3>
      <p className="mt-2 text-sm text-text-muted">{desc}</p>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.song} className="relative overflow-hidden rounded-lg bg-white/5 px-3 py-2">
            <div
              className="absolute inset-y-0 left-0 bg-action-red/20"
              style={{ width: `${r.pct}%` }}
            />
            <div className="relative flex items-center justify-between text-sm">
              <span>
                {r.song} <span className="text-text-muted">— {r.artist}</span>
              </span>
              <span className="font-mono text-xs text-text-muted">{r.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CreateEventForm() {
  const router = useRouter();
  const user = db.useUser();
  const [name, setName] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");

    try {
      const code = generateJoinCode();
      const eventId = id();
      const membershipId = id();

      await db.transact([
        db.tx.events[eventId].update({
          name: trimmed,
          joinCode: code,
          creatorId: user.id,
          createdAt: Date.now(),
        }),
        db.tx.memberships[membershipId]
          .update({
            userId: user.id,
            lookupKey: `${eventId}:${user.id}`,
            createdAt: Date.now(),
          })
          .link({ event: eventId }),
      ]);

      const trimmedUrl = playlistUrl.trim();
      const dest = trimmedUrl
        ? `/event/${code}?share=${encodeURIComponent(trimmedUrl)}`
        : `/event/${code}`;
      router.push(dest);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-col">
      <label htmlFor="event-name" className="text-sm font-medium text-landing-muted">
        Event Name
      </label>
      <input
        id="event-name"
        type="text"
        required
        maxLength={120}
        placeholder="Saturday Night Party"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1.5 rounded-lg border border-landing-border bg-landing-input-bg px-3 py-2 text-sm text-landing-ink shadow-sm placeholder:text-landing-muted/50 focus-visible:border-landing-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-accent/30"
      />
      <label htmlFor="playlist-url" className="mt-3 text-sm font-medium text-landing-muted">
        Playlist URL <span className="font-normal">(optional)</span>
      </label>
      <input
        id="playlist-url"
        type="url"
        maxLength={500}
        placeholder="Paste a Spotify, YouTube, or Apple Music playlist link"
        value={playlistUrl}
        onChange={(e) => setPlaylistUrl(e.target.value)}
        className="mt-1.5 rounded-lg border border-landing-border bg-landing-input-bg px-3 py-2 text-sm text-landing-ink shadow-sm placeholder:text-landing-muted/50 focus-visible:border-landing-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-accent/30"
      />
      <div className="mt-1.5 min-h-[1.25rem]">
        {error && <p className="text-sm text-action-red">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="mt-1 rounded-lg bg-gradient-to-r from-neon-orange to-brand-gold px-4 py-2.5 text-sm font-bold text-canvas shadow-md shadow-neon-orange/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg disabled:opacity-50"
      >
        {busy ? "Creating\u2026" : "Create Event"}
      </button>
    </form>
  );
}

function JoinEventForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeCode(code);
    if (normalized.length < 4) {
      setError("Please enter a valid event code.");
      return;
    }
    setError("");
    router.push(`/event/${normalized}`);
  }

  return (
    <form onSubmit={handleJoin} className="flex flex-col">
      <label htmlFor="join-code" className="text-sm font-medium text-landing-muted">
        Event Code
      </label>
      <input
        id="join-code"
        type="text"
        required
        maxLength={12}
        placeholder="e.g. AB3K7V"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="mt-1.5 rounded-lg border border-landing-border bg-landing-input-bg px-3 py-2 text-sm font-mono tracking-widest text-landing-ink shadow-sm placeholder:text-landing-muted/50 placeholder:tracking-normal placeholder:font-sans focus-visible:border-landing-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-accent/30"
      />
      <div className="mt-1.5 min-h-[1.25rem]">
        {error && <p className="text-sm text-action-red">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={!code.trim()}
        className="mt-1 rounded-lg border border-neon-orange/30 bg-landing-bg px-4 py-2.5 text-sm font-bold text-landing-ink transition hover:bg-neon-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
