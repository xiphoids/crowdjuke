# CrowdJuke

A collaborative digital jukebox. Hosts create events and share a short code with guests, who add song requests and vote the playlist into order — all in realtime.

## Stack

- **Next.js** (App Router) + TypeScript
- **InstantDB** for realtime data and Guest Auth
- **Tailwind CSS** for styling

## Getting started

1. **Create an Instant app** at [instantdb.com](https://www.instantdb.com/) and copy your App ID.

2. **Configure environment** — copy the example and fill in your App ID:

   ```bash
   cp .env.example .env.local
   ```

3. **Install dependencies and run**:

   ```bash
   npm install
   npm run dev
   ```

4. **Push schema and permissions** to your Instant app (first time only):

   ```bash
   npx instant-cli@latest push schema
   npx instant-cli@latest push perms
   ```

Open [http://localhost:3000](http://localhost:3000) — create an event, share the code, and start adding songs.
# crowdjuke
