import { MusicNoteIcon } from "./MusicNoteIcon";

export default function LoadingSpinner({ label = "Loading\u2026" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status">
      <MusicNoteIcon className="h-10 w-10 text-ui-cyan animate-glow-breathe" />
      <p className="animate-pulse text-text-muted text-sm tracking-wide">
        {label}
      </p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
