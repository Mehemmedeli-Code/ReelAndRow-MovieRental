import { motion } from "motion/react";
import { Clapperboard, Info, Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatRuntime } from "@/lib/format";
import { t } from "@/lib/i18n";

export interface MovieListItem {
  id: string;
  title: string;
  slug: string;
  genre: string;
  releaseYear: number;
  durationMinutes: number;
  dailyPrice: number;
  availableCopies: number;
  totalCopies: number;
  averageRating: number;
  reviewCount: number;
  posterUrl?: string | null;
  isDeleted: boolean;
  hasVideo: boolean;
}

export function MovieCard({
  movie,
  index,
  onRent,
  onOpen,
  busy,
}: {
  movie: MovieListItem;
  index: number;
  onRent?: (movie: MovieListItem) => void;
  /** Opens the dialog, either on the description or straight into the player. */
  onOpen?: (movie: MovieListItem, mode: "details" | "watch") => void;
  busy?: boolean;
}) {
  const available = movie.availableCopies > 0;

  return (
    <motion.article
      // A single orchestrated entrance for the grid: each card lands a beat after the one
      // before it, then nothing moves again until the reader acts.
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index * 0.04, 0.4) }}
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-surface">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-accent-dim">
            <Clapperboard size={40} strokeWidth={1.2} aria-hidden />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-surface/85 px-2.5 py-1 text-xs text-ink-mute">
          {movie.genre}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg leading-snug text-ink">{movie.title}</h3>
          <p className="mt-1 text-xs text-ink-mute">
            {movie.releaseYear} · {formatRuntime(movie.durationMinutes)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-mute">
          <Star size={13} className="text-accent" fill="currentColor" aria-hidden />
          {movie.reviewCount > 0 ? (
            <span>
              {movie.averageRating.toFixed(1)} from {movie.reviewCount} review{movie.reviewCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink">{formatMoney(movie.dailyPrice)}<span className="text-ink-mute"> / day</span></p>
            <Badge tone={available ? "good" : "bad"}>
              {available ? `${movie.availableCopies} ${t("movie.onShelf")}` : t("movie.allOut")}
            </Badge>
          </div>

          {/* Renting and watching are different intentions, so they get different buttons.
              Watch stays disabled until a film actually has a video behind it — a button
              that opens an empty player is worse than one that is visibly not ready. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {onOpen ? (
              <Button size="sm" variant="outline" onClick={() => onOpen(movie, "details")}>
                <Info size={14} aria-hidden />
                {t("movie.details")}
              </Button>
            ) : null}

            {onOpen ? (
              <Button
                size="sm"
                variant={movie.hasVideo ? "solid" : "outline"}
                disabled={!movie.hasVideo}
                title={movie.hasVideo ? undefined : t("movie.noVideo")}
                onClick={() => onOpen(movie, "watch")}
              >
                <Play size={14} aria-hidden />
                {t("movie.watch")}
              </Button>
            ) : null}

            {onRent ? (
              <Button size="sm" variant="outline" disabled={!available || busy} onClick={() => onRent(movie)}>
                {busy ? t("movie.renting") : t("movie.rent")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
