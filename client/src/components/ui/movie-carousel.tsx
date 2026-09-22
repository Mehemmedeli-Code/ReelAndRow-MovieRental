import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POSTERS } from "@/components/PosterArt";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { MovieListItem } from "@/components/MovieCard";

/**
 * Stacked, draggable carousel adapted from the 21st.dev "carousel-07" component.
 *
 * What changed from the original, and why:
 *
 *  - `"use client"` removed. That directive is a Next.js App Router marker; this is a Vite
 *    build where every module is already client-side, and leaving it in is dead weight.
 *  - shadcn colour tokens (`bg-background`, `bg-muted`, `text-foreground`) replaced with this
 *    project's role tokens. We never installed the shadcn base stylesheet, so those classes
 *    would have resolved to nothing and the cards would have rendered transparent.
 *  - The original's `<Badge variant="…">` became `<Badge tone="…">`: our Badge exposes a
 *    semantic tone, not shadcn's variant set.
 *  - `h-112` / `h-128` dropped. Neither exists in Tailwind's default scale, so both were
 *    silently doing nothing; replaced with explicit arbitrary heights.
 *  - Hardcoded slide array replaced by real catalogue rows. A carousel of five fixed
 *    holiday photos is a demo; this one shows what is actually on the shelf.
 *  - Remote CDN images replaced by the locally drawn SVG posters already used by the hero,
 *    chosen by genre. No network request, nothing to 404 in six months, and it matches the
 *    brief's "clean vector art". A real `posterUrl` still wins when the film has one.
 *  - Drag-only navigation was the original's one real flaw: it is unusable by keyboard and
 *    invisible to a screen reader. Arrow buttons, arrow keys and proper labels added.
 *  - `prefers-reduced-motion` respected — the spring is replaced by an instant jump.
 */

interface CarouselConfig {
  distanceDivisor: number;
  velocityDivisor: number;
  sensitivity: number;
  xMultiplier: number;
  yMultiplier: number;
  rotationMultiplier: number;
  scaleReduction: number;
}

/** Fan the cards wider as the viewport grows; on a phone they stay nearly stacked. */
const configFor = (width: number): CarouselConfig => {
  if (width < 640) {
    return { distanceDivisor: 120, velocityDivisor: 500, sensitivity: 180,
             xMultiplier: 90, yMultiplier: 20, rotationMultiplier: 8, scaleReduction: 0.06 };
  }
  if (width < 1024) {
    return { distanceDivisor: 160, velocityDivisor: 650, sensitivity: 220,
             xMultiplier: 130, yMultiplier: 30, rotationMultiplier: 10, scaleReduction: 0.09 };
  }
  return { distanceDivisor: 200, velocityDivisor: 800, sensitivity: 250,
           xMultiplier: 170, yMultiplier: 40, rotationMultiplier: 12, scaleReduction: 0.12 };
};

/** Genre names are free text, so match loosely and fall back to a stable per-title choice. */
function posterFor(movie: MovieListItem) {
  const genre = movie.genre.toLowerCase();
  const direct = POSTERS.find((poster) =>
    genre.includes(poster.key) ||
    (poster.key === "scifi" && genre.includes("science")) ||
    (poster.key === "documentary" && genre.includes("doc")));

  if (direct) return direct;

  const hash = [...movie.title].reduce((total, char) => total + char.charCodeAt(0), 0);
  return POSTERS[hash % POSTERS.length];
}

export function MovieCarousel({
  movies,
  onRent,
  onOpen,
  busyId,
}: {
  movies: MovieListItem[];
  onRent?: (movie: MovieListItem) => void;
  onOpen?: (movie: MovieListItem, mode: "details" | "watch") => void;
  busyId?: string | null;
}) {
  const progress = useMotionValue(0);
  const dragStart = useRef(0);
  const [width, setWidth] = useState(1280);
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();

  const total = movies.length;

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const config = useMemo(() => configFor(width), [width]);

  // Which card is centred, so only that one offers its Rent button.
  useMotionValueEvent(progress, "change", (value) => {
    if (total === 0) return;
    setActive(((Math.round(value) % total) + total) % total);
  });

  const goTo = useCallback((target: number) => {
    if (reduceMotion) { progress.set(target); return; }
    animate(progress, target, { type: "spring", stiffness: 200, damping: 30, mass: 1 });
  }, [progress, reduceMotion]);

  const step = useCallback((direction: 1 | -1) => {
    goTo(Math.round(progress.get()) + direction);
  }, [goTo, progress]);

  function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const fromDistance = -info.offset.x / config.distanceDivisor;
    const fromVelocity = -info.velocity.x / config.velocityDivisor;
    // Clamped so one violent flick cannot spin past three cards and lose the reader.
    const shift = Math.max(-3, Math.min(3, Math.round(fromDistance + fromVelocity)));
    goTo(Math.round(dragStart.current) + shift);
  }

  if (total === 0) return null;

  const current = movies[active];

  return (
    <div className="w-full select-none">
      <div
        className="relative flex h-80 w-full items-center justify-center overflow-hidden sm:h-[26rem] lg:h-[30rem]"
        role="group"
        aria-roledescription="carousel"
        aria-label={t("featured.title")}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
        }}
      >
        {/* One transparent surface takes the drag, so the cards themselves stay inert and
            never swallow a click meant for the button underneath. */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={() => { dragStart.current = progress.get(); }}
          onDrag={(_, info) => progress.set(progress.get() - info.delta.x / config.sensitivity)}
          onDragEnd={onDragEnd}
          className="absolute inset-0 z-50 cursor-grab active:cursor-grabbing"
          aria-hidden
        />

        {movies.map((movie, index) => (
          <PosterCard
            key={movie.id}
            movie={movie}
            index={index}
            total={total}
            progress={progress}
            config={config}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => step(-1)} aria-label={t("common.prev")}>
            <ChevronLeft size={15} aria-hidden />
          </Button>

          <p className="min-w-[14ch] text-center text-xs text-ink-mute" aria-live="polite">
            {active + 1} / {total}
          </p>

          <Button size="sm" variant="outline" onClick={() => step(1)} aria-label={t("common.next")}>
            <ChevronRight size={15} aria-hidden />
          </Button>
        </div>

        {/* The centred film's details live outside the stack: text that rotates and scales
            with a card is unreadable, and a button that moves is hard to hit. */}
        <div className="text-center">
          <p className="font-display text-xl text-ink">{current.title}</p>
          <p className="mt-1 text-xs text-ink-mute">
            {current.genre} · {current.releaseYear} · {formatMoney(current.dailyPrice)}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {onOpen ? (
              <Button size="sm" variant="outline" onClick={() => onOpen(current, "details")}>
                {t("movie.details")}
              </Button>
            ) : null}

            {onOpen ? (
              <Button
                size="sm"
                disabled={!current.hasVideo}
                title={current.hasVideo ? undefined : t("movie.noVideo")}
                onClick={() => onOpen(current, "watch")}
              >
                {t("movie.watch")}
              </Button>
            ) : null}

            {onRent ? (
              <Button
                size="sm"
                variant="outline"
                disabled={current.availableCopies === 0 || busyId === current.id}
                onClick={() => onRent(current)}
              >
                {busyId === current.id ? t("movie.renting")
                  : current.availableCopies === 0 ? t("movie.allOut") : t("movie.rent")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PosterCard({
  movie, index, total, progress, config,
}: {
  movie: MovieListItem;
  index: number;
  total: number;
  progress: MotionValue<number>;
  config: CarouselConfig;
}) {
  // Signed distance from centre, wrapped so the stack is a ring rather than a line.
  const offset = useTransform(progress, (value) => {
    let diff = (index - value) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  });

  const x = useTransform(offset, (o) => o * config.xMultiplier);
  const y = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : Math.abs(o) * config.yMultiplier));
  const rotate = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : o * config.rotationMultiplier));
  const scale = useTransform(offset, (o) => 1 - Math.abs(o) * config.scaleReduction);
  const opacity = useTransform(
    offset,
    [-total / 2, -total / 2 + 0.5, 0, total / 2 - 0.5, total / 2],
    [0, 1, 1, 1, 0],
  );
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10));
  // Cards away from centre dim, which is what makes the stack read as depth.
  const shade = useTransform(offset, [-2, -0.5, 0, 0.5, 2], [0.55, 0.22, 0, 0.22, 0.55]);

  const poster = posterFor(movie);

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity, zIndex }}
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-2xl border border-line bg-surface-raised",
        "h-56 w-44 sm:h-80 sm:w-56 lg:h-96 lg:w-64",
      )}
      aria-hidden={index !== 0}
    >
      {movie.posterUrl ? (
        <img src={movie.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full">{poster.render()}</div>
      )}

      <motion.div style={{ opacity: shade }} className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/20 to-transparent" />

      <Badge tone="warn" className="absolute right-3 top-3 uppercase tracking-widest sm:right-4 sm:top-4">
        {movie.genre}
      </Badge>
    </motion.div>
  );
}

export default MovieCarousel;
