function formatTrackDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Track {
  id: number;
  title: string;
  duration: number;
  explicitLyrics?: boolean;
}

export default function TrackList({ tracks }: { tracks: Track[] }) {
  return (
    <div className="flex flex-col divide-y divide-white/[0.06]">
      {tracks.map((t, i) => (
        <div key={t.id} className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-3">
            <span className="w-5 text-right text-[13px] tabular-nums text-neutral-500">
              {i + 1}
            </span>
            <span className="text-[14px] text-neutral-200">{t.title}</span>
            {t.explicitLyrics && (
              <span
                aria-label="Contenido explícito"
                title="Contenido explícito"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-neutral-800 text-[9px] font-bold leading-none text-neutral-200"
              >
                E
              </span>
            )}
          </div>
          <span className="text-[13px] tabular-nums text-neutral-500">
            {formatTrackDuration(t.duration)}
          </span>
        </div>
      ))}
    </div>
  );
}