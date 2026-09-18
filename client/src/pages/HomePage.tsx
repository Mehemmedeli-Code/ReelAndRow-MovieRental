import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import StackSpread from "@/components/ui/stack-spread";
import { MovieCard, type MovieListItem } from "@/components/MovieCard";
import { Section, Notice, Empty, Spinner } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useAuth } from "@/components/useAuth";
import { get, post, query, ApiError, type Paged } from "@/lib/api";

const SORTS = [
  { value: "newest", label: "Recently added" },
  { value: "title", label: "Title A–Z" },
  { value: "year", label: "Release year" },
  { value: "rating", label: "Rating" },
  { value: "price", label: "Daily price" },
];

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const [genres, setGenres] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [genre, setGenre] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [sortDir, setSortDir] = useState("desc");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [data, setData] = useState<Paged<MovieListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rentingId, setRentingId] = useState<string | null>(null);

  // Debounce keeps the catalogue responsive without a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    get<string[]>("/api/movies/genres").then(setGenres).catch(() => setGenres([]));
  }, []);

  const url = useMemo(
    () =>
      "/api/movies" +
      query({ search: debounced, genre, sortBy, sortDir, onlyAvailable, page, pageSize: 12 }),
    [debounced, genre, sortBy, sortDir, onlyAvailable, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await get<Paged<MovieListItem>>(url));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The catalogue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rent(movie: MovieListItem) {
    if (!isSignedIn) {
      window.location.href = "/account";
      return;
    }

    setRentingId(movie.id);
    setMessage(null);
    try {
      await post("/api/rentals", { movieId: movie.id, days: 7 });
      setMessage(`${movie.title} is yours for seven days.`);
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "The rental could not be completed.");
    } finally {
      setRentingId(null);
    }
  }

  return (
    <>
      <StackSpread
        headline="Eight shelves."
        headlineMuted=" One "
        headlineTail="counter."
        subtitle="Rent a film, book a seat for tonight, or put your own short in front of a reviewer."
      >
        <a href="#catalogue" className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-surface">
          Browse the catalogue
        </a>
      </StackSpread>

      <Section
        title="The catalogue"
        lede="Search by title, director or plot. Filters and sorting run server-side, so the page you land on is the page you can link to."
        className="scroll-mt-20"
      >
        <div id="catalogue" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" aria-hidden />
            <Input
              className="pl-9"
              placeholder="Search titles, directors, plots"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the catalogue"
            />
          </div>

          <Select value={genre} onChange={(e) => { setGenre(e.target.value); setPage(1); }} aria-label="Genre">
            <option value="all">Every genre</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>

          <Select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            >
              {sortDir === "desc" ? "Descending" : "Ascending"}
            </Button>
            <Button
              variant={onlyAvailable ? "solid" : "outline"}
              className="flex-1"
              aria-pressed={onlyAvailable}
              onClick={() => { setOnlyAvailable((v) => !v); setPage(1); }}
            >
              In stock
            </Button>
          </div>
        </div>

        {message ? <div className="mb-4"><Notice tone="info">{message}</Notice></div> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        {loading && !data ? <Spinner label="Fetching the shelves" /> : null}

        {data && data.items.length === 0 ? (
          <Empty
            title="Nothing matches those filters"
            hint="Widen the genre, clear the search box, or turn off the in-stock filter."
            action={<Button variant="outline" onClick={() => { setSearch(""); setGenre("all"); setOnlyAvailable(false); }}>Clear filters</Button>}
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {data.items.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} onRent={rent} busy={rentingId === movie.id} />
              ))}
            </div>

            <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Catalogue pages">
              <Button variant="outline" size="sm" disabled={!data.hasPrevious} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <p className="text-sm text-ink-mute">
                Page {data.page} of {data.totalPages} · {data.totalCount} titles
              </p>
              <Button variant="outline" size="sm" disabled={!data.hasNext} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </nav>
          </>
        ) : null}
      </Section>
    </>
  );
}
