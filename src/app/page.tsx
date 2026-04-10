"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { generateJoinCode, normalizeCode } from "@/lib/joinCode";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
          CrowdJuke
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Your crowd, your playlist.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-6 md:grid-cols-2">
        <CreateEventCard />
        <JoinEventCard />
      </div>
    </main>
  );
}

function CreateEventCard() {
  const router = useRouter();
  const user = db.useUser();
  const [name, setName] = useState("");
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

      router.push(`/event/${code}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
    >
      <h2 className="text-lg font-semibold text-gray-900">Host an Event</h2>
      <p className="mt-1 text-sm text-gray-500">
        Create a new event and share the code with your guests.
      </p>

      <label htmlFor="event-name" className="mt-5 text-sm font-medium text-gray-700">
        Event name
      </label>
      <input
        id="event-name"
        type="text"
        required
        maxLength={120}
        placeholder="Saturday Night Party"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
      >
        {busy ? "Creating\u2026" : "Create Event"}
      </button>
    </form>
  );
}

function JoinEventCard() {
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
    <form
      onSubmit={handleJoin}
      className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
    >
      <h2 className="text-lg font-semibold text-gray-900">Join an Event</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enter the code shared by the event host.
      </p>

      <label htmlFor="join-code" className="mt-5 text-sm font-medium text-gray-700">
        Event code
      </label>
      <input
        id="join-code"
        type="text"
        required
        maxLength={12}
        placeholder="e.g. AB3K7V"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest shadow-sm placeholder:text-gray-400 placeholder:tracking-normal placeholder:font-sans focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!code.trim()}
        className="mt-5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/40 disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
