import { useEffect, useRef, useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { Section, Panel, Notice, Empty, Spinner } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/useAuth";
import { get, postForm, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface ShortFilm {
  id: string;
  title: string;
  synopsis: string;
  originalFileName: string;
  sizeBytes: number;
  status: "Pending" | "Approved" | "Rejected" | "Expired";
  submittedAtUtc: string;
  reviewDeadlineUtc: string;
  hoursLeft: number;
  reviewerNote?: string | null;
}

const AI_STUDIO_URL = "https://higgsfield.ai/";
const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

export default function StudioPage() {
  const { isSignedIn } = useAuth();
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [mine, setMine] = useState<ShortFilm[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    get<ShortFilm[]>("/api/shorts/mine").then(setMine).catch(() => setMine([]));
  }, [isSignedIn]);

  async function upload() {
    if (!file || !title) return;
    setBusy(true);
    setMessage(null);

    const form = new FormData();
    form.append("title", title);
    form.append("synopsis", synopsis);
    form.append("file", file);

    try {
      await postForm<ShortFilm>("/api/shorts", form);
      setMessage({ tone: "ok", text: "Submitted. A reviewer answers within three days." });
      setTitle("");
      setSynopsis("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMine(await get<ShortFilm[]>("/api/shorts/mine"));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "The upload did not finish." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Studio" lede="Send us a short film, or generate a promo clip first and submit that.">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <h3 className="font-display text-xl text-ink">Submit a short</h3>
          <p className="mt-1 text-sm text-ink-mute">
            MP4, MOV, WEBM or MKV, up to 512 MB. Every submission gets a human decision within three days.
          </p>

          {!isSignedIn ? (
            <div className="mt-5">
              <Notice tone="info">Sign in first — submissions are tied to your account.</Notice>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The last tram" />
              </Field>

              <Field label="Synopsis" hint="Two or three sentences is plenty.">
                <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
              </Field>

              <Field label="Film file">
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-ink-mute file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-surface"
                />
              </Field>

              {file ? <p className="text-xs text-ink-mute">{file.name} · {megabytes(file.size)}</p> : null}
              {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

              <Button disabled={!file || !title || busy} onClick={upload}>
                <Upload size={15} aria-hidden />
                {busy ? "Uploading…" : "Send for review"}
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xl text-ink">Need footage first?</h3>
            <p className="mt-1 text-sm text-ink-mute">
              Generate a short promotional clip with audio in an external AI video tool, download it, then submit it here
              like any other short.
            </p>
          </div>
          <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex">
            <Button variant="outline">
              <Sparkles size={15} aria-hidden />
              Open the video studio
            </Button>
          </a>
        </Panel>
      </div>

      {isSignedIn ? (
        <div className="mt-10">
          <h3 className="font-display text-2xl text-ink">Your submissions</h3>

          {mine === null ? <Spinner label="Checking the queue" /> : null}
          {mine?.length === 0 ? (
            <div className="mt-4">
              <Empty title="Nothing submitted yet" hint="Upload a film above and it appears here with a countdown to its decision." />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {mine?.map((film) => (
              <Panel key={film.id} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-lg text-ink">{film.title}</p>
                  <p className="mt-1 text-xs text-ink-mute">
                    {film.originalFileName} · {megabytes(film.sizeBytes)} · sent {formatDateTime(film.submittedAtUtc)}
                  </p>
                  {film.reviewerNote ? <p className="mt-2 text-sm text-ink">{film.reviewerNote}</p> : null}
                </div>

                <div className="text-right">
                  <Badge tone={film.status === "Approved" ? "good" : film.status === "Rejected" ? "bad" : "warn"}>
                    {film.status}
                  </Badge>
                  {film.status === "Pending" ? (
                    <p className="mt-1.5 text-xs text-ink-mute">{film.hoursLeft}h left on the review window</p>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
