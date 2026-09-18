import { useCallback, useEffect, useState } from "react";
import { Section, Panel, Notice, Empty, Spinner } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VectorBarChart, type ChartSeries } from "@/components/VectorChart";
import { useAuth } from "@/components/useAuth";
import { get, post, put, patch, del, query, ApiError, type Paged } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { MovieListItem } from "@/components/MovieCard";

interface RentalStats {
  activeCount: number;
  overdueCount: number;
  returnedCount: number;
  outstandingLateFees: number;
  revenueThisMonth: number;
}

interface PendingShort {
  id: string;
  title: string;
  authorName: string;
  synopsis: string;
  hoursLeft: number;
  reviewDeadlineUtc: string;
}

const BLANK = {
  title: "",
  description: "",
  genre: "Drama",
  releaseYear: new Date().getFullYear(),
  durationMinutes: 100,
  director: "",
  posterUrl: "",
  trailerUrl: "",
  dailyPrice: 2.5,
  totalCopies: 3,
};

export default function AdminPage() {
  const { isAdmin, isSignedIn } = useAuth();
  const [stats, setStats] = useState<RentalStats | null>(null);
  const [charts, setCharts] = useState<ChartSeries[]>([]);
  const [movies, setMovies] = useState<Paged<MovieListItem> | null>(null);
  const [shorts, setShorts] = useState<PendingShort[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const [statsData, chartData, movieData, shortData] = await Promise.all([
        get<RentalStats>("/api/admin/rentals/stats"),
        get<ChartSeries[]>("/api/admin/analytics/overview"),
        get<Paged<MovieListItem>>("/api/movies" + query({ includeDeleted: showDeleted, pageSize: 24, sortBy: "title" })),
        get<PendingShort[]>("/api/admin/shorts/pending"),
      ]);
      setStats(statsData);
      setCharts(chartData);
      setMovies(movieData);
      setShorts(shortData);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "The dashboard could not load." });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showDeleted]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>, successText: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "ok", text: successText });
      await load();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "That action failed." });
    }
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <Section title="Admin" lede="This dashboard is limited to accounts with the Admin role.">
        <Empty
          title="Admin access required"
          hint="Sign in with admin@reelandrow.test / Admin1234 to manage inventory, rentals and submissions."
          action={<a href="/account"><Button>Sign in</Button></a>}
        />
      </Section>
    );
  }

  return (
    <>
      <Section title="Where things stand" lede="Live counts across rentals, and what your customers are actually watching.">
        {loading ? <Spinner label="Gathering numbers" /> : null}
        {message ? <div className="mb-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}

        {stats ? (
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Out on rental", value: String(stats.activeCount) },
              { label: "Overdue", value: String(stats.overdueCount) },
              { label: "Returned", value: String(stats.returnedCount) },
              { label: "Unpaid late fees", value: formatMoney(stats.outstandingLateFees) },
              { label: "Revenue this month", value: formatMoney(stats.revenueThisMonth) },
            ].map((tile) => (
              <Panel key={tile.label} className="py-4">
                <p className="font-display text-2xl text-accent">{tile.value}</p>
                <p className="mt-1 text-xs text-ink-mute">{tile.label}</p>
              </Panel>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {charts.map((series) => (
            <VectorBarChart key={series.key} series={series} />
          ))}
        </div>
      </Section>

      <Section
        title="Inventory"
        lede="Deleting is reversible: rows are flagged, never dropped, so a restore puts the title straight back on the shelf."
        actions={
          <Button variant="outline" size="sm" aria-pressed={showDeleted} onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "Hide removed titles" : "Show removed titles"}
          </Button>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised text-xs text-ink-mute">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {movies?.items.map((movie) => (
                  <tr key={movie.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <p className="text-ink">{movie.title}</p>
                      <p className="text-xs text-ink-mute">{movie.genre} · {movie.releaseYear}</p>
                      {movie.isDeleted ? <Badge tone="bad" className="mt-1">Removed</Badge> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={movie.totalCopies}
                          className="h-8 w-20"
                          aria-label={`Total copies of ${movie.title}`}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (next !== movie.totalCopies) {
                              void run(() => patch(`/api/admin/movies/${movie.id}/stock`, { totalCopies: next }), "Stock updated.");
                            }
                          }}
                        />
                        <span className="text-xs text-ink-mute">{movie.availableCopies} free</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-mute">{formatMoney(movie.dailyPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      {movie.isDeleted ? (
                        <Button size="sm" variant="outline" onClick={() => run(() => post(`/api/admin/movies/${movie.id}/restore`), "Title restored.")}>
                          Restore
                        </Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => run(() => del(`/api/admin/movies/${movie.id}`), "Title removed.")}>
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Panel>
            <h3 className="font-display text-lg text-ink">Add a title</h3>
            <div className="mt-4 space-y-3">
              <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Genre"><Input value={draft.genre} onChange={(e) => setDraft({ ...draft, genre: e.target.value })} /></Field>
                <Field label="Year"><Input type="number" value={draft.releaseYear} onChange={(e) => setDraft({ ...draft, releaseYear: Number(e.target.value) })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minutes"><Input type="number" value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></Field>
                <Field label="Copies"><Input type="number" value={draft.totalCopies} onChange={(e) => setDraft({ ...draft, totalCopies: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Daily price"><Input type="number" step="0.25" value={draft.dailyPrice} onChange={(e) => setDraft({ ...draft, dailyPrice: Number(e.target.value) })} /></Field>
              <Field label="Poster URL"><Input value={draft.posterUrl} onChange={(e) => setDraft({ ...draft, posterUrl: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>

              <Button
                className="w-full"
                disabled={!draft.title}
                onClick={() => run(async () => { await post("/api/admin/movies", draft); setDraft(BLANK); }, "Title added to the catalogue.")}
              >
                Add to catalogue
              </Button>
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Awaiting review" lede="Ordered by deadline. The oldest submission is always the one closest to breaching its three-day promise.">
        {shorts.length === 0 ? (
          <Empty title="The queue is clear" hint="New submissions from the Studio page land here the moment they upload." />
        ) : (
          <div className="space-y-3">
            {shorts.map((film) => (
              <Panel key={film.id} className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[60ch]">
                  <p className="font-display text-lg text-ink">{film.title}</p>
                  <p className="text-xs text-ink-mute">
                    by {film.authorName} · decide before {formatDate(film.reviewDeadlineUtc)}
                  </p>
                  {film.synopsis ? <p className="mt-2 text-sm text-ink-mute">{film.synopsis}</p> : null}
                  <Badge tone={film.hoursLeft < 12 ? "bad" : "warn"} className="mt-2">{film.hoursLeft}h left</Badge>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => run(() => put(`/api/admin/shorts/${film.id}/decision`, { approve: true, note: "Accepted for the shorts strand." }), "Submission approved.")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => run(() => put(`/api/admin/shorts/${film.id}/decision`, { approve: false, note: "Not a fit this round." }), "Submission rejected.")}>
                    Reject
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
