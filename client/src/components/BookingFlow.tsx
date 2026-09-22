import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CreditCard, Ticket } from "lucide-react";
import { Panel, Notice } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { post, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { t, formatWhen, languageName } from "@/lib/i18n";

export interface SeatSelection { row: number; number: number }

interface CheckoutStarted {
  paymentId: string;
  reference: string;
  amount: number;
  brand: string;
  last4: string;
  maskedEmail: string;
  expiresAtUtc: string;
}

interface TicketResponse {
  reference: string;
  movieTitle: string;
  hall: string;
  startsAtUtc: string;
  audioLanguage: string;
  subtitleLanguage?: string | null;
  seats: SeatSelection[];
  amount: number;
  brand: string;
  last4: string;
  confirmedAtUtc: string;
  qrPayload: string;
}

const seatLabel = (seat: SeatSelection) => `${String.fromCharCode(64 + seat.row)}${seat.number}`;

/** Groups digits in fours as you type. Nothing is validated here — the server decides. */
const groupDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

/**
 * Pay, then confirm with the code that arrives by e-mail, then the ticket.
 *
 * The card never reaches this component's state in a form anyone could persist: it is read
 * from the inputs, posted once, and the fields are cleared. The server keeps only the brand
 * and the last four digits.
 */
export function BookingFlow({
  screeningId,
  seats,
  seatPrice,
  onCancel,
  onBooked,
}: {
  screeningId: string;
  seats: SeatSelection[];
  seatPrice: number;
  onCancel: () => void;
  onBooked: () => void;
}) {
  const [step, setStep] = useState<"payment" | "code" | "ticket">("payment");
  const [checkout, setCheckout] = useState<CheckoutStarted | null>(null);
  const [ticket, setTicket] = useState<TicketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [code, setCode] = useState("");

  const total = seatPrice * seats.length;

  async function pay() {
    const [month, year] = expiry.split("/").map((part) => Number(part.trim()));
    setBusy(true);
    setError(null);
    try {
      const started = await post<CheckoutStarted>(`/api/screenings/${screeningId}/checkout`, {
        seats,
        card: {
          number: number.replace(/\s/g, ""),
          expiryMonth: month || 0,
          expiryYear: year || 0,
          cvc,
          holderName: holder,
        },
      });
      // Cleared the moment they are no longer needed.
      setNumber(""); setCvc(""); setExpiry("");
      setCheckout(started);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.booking"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!checkout) return;
    setBusy(true);
    setError(null);
    try {
      setTicket(await post<TicketResponse>(`/api/bookings/${checkout.paymentId}/confirm`, { code }));
      setStep("ticket");
      onBooked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error.booking"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "ticket" && ticket) return <TicketCard ticket={ticket} onDone={onCancel} />;

  if (step === "code" && checkout) {
    return (
      <Panel>
        <h3 className="font-display text-xl text-ink">{t("book.codeTitle")}</h3>
        <p className="mt-1 text-sm text-ink-mute">{t("book.codeLede")}</p>
        <p className="mt-1 text-xs text-ink-mute">{checkout.maskedEmail}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>{t("book.reference")}: {checkout.reference}</Badge>
          <Badge tone="warn">
            {t("book.heldUntil")} {formatWhen(checkout.expiresAtUtc, { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        </div>

        <div className="mt-5 max-w-xs">
          <Field label={t("account.code")}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </Field>
        </div>

        {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}

        <div className="mt-4 flex gap-2">
          <Button disabled={busy || code.length !== 6} onClick={confirm}>
            {busy ? t("common.loading") : t("book.confirmSeats")}
          </Button>
          <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <h3 className="flex items-center gap-2 font-display text-xl text-ink">
        <CreditCard size={18} aria-hidden />
        {t("book.payment")}
      </h3>
      <p className="mt-1 text-sm text-ink-mute">{t("book.paymentLede")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>{seats.map(seatLabel).join(", ")}</Badge>
        <Badge tone="good">{t("book.total")}: {formatMoney(total)}</Badge>
      </div>

      <div className="mt-5 grid max-w-md gap-3">
        <Field label={t("book.cardNumber")} hint="4242 4242 4242 4242">
          <Input
            value={number}
            onChange={(e) => setNumber(groupDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("book.expiry")} hint="MM/YY">
            <Input
              value={expiry}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
              }}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="12/29"
            />
          </Field>
          <Field label={t("book.cvc")}>
            <Input
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
            />
          </Field>
        </div>

        <Field label={t("book.holder")}>
          <Input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="cc-name" />
        </Field>
      </div>

      {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
      <div className="mt-3"><Notice tone="info">{t("book.simulated")}</Notice></div>

      <div className="mt-4 flex gap-2">
        <Button disabled={busy || !number || !expiry || !cvc || !holder} onClick={pay}>
          {busy ? t("book.paying") : `${t("book.pay")} ${formatMoney(total)}`}
        </Button>
        <Button variant="outline" onClick={onCancel}>{t("book.back")}</Button>
      </div>
    </Panel>
  );
}

function TicketCard({ ticket, onDone }: { ticket: TicketResponse; onDone: () => void }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    // Rendered locally: the payload is short, and generating it here means the ticket
    // still draws if the network drops on the way to the cinema.
    QRCode.toDataURL(ticket.qrPayload, {
      width: 320,
      margin: 1,
      color: { dark: "#0A0C0A", light: "#FFFFFF" },
    }).then(setQr).catch(() => setQr(null));
  }, [ticket.qrPayload]);

  return (
    <Panel>
      <h3 className="flex items-center gap-2 font-display text-xl text-ink">
        <Ticket size={18} aria-hidden />
        {t("book.ticket")}
      </h3>

      <div className="mt-4 grid gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-2xl text-ink">{ticket.movieTitle}</p>
          <p className="mt-1 text-sm text-ink-mute">
            {ticket.hall} · {formatWhen(ticket.startsAtUtc)}
          </p>
          <p className="mt-1 text-sm text-accent">
            {languageName(ticket.audioLanguage)}
            {ticket.subtitleLanguage ? ` · ${t("onDisplay.subtitles")}: ${languageName(ticket.subtitleLanguage)}` : ""}
          </p>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-mute">{t("book.reference")}:</dt>
              <dd className="font-display tracking-widest text-accent">{ticket.reference}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-mute">{t("book.seats")}:</dt>
              <dd className="text-ink">{ticket.seats.map(seatLabel).join(", ")}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-mute">{t("book.total")}:</dt>
              <dd className="text-ink">{formatMoney(ticket.amount)} · {ticket.brand} ···· {ticket.last4}</dd>
            </div>
          </dl>
        </div>

        <div className="text-center">
          {qr ? (
            <img src={qr} alt={ticket.reference} className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
          ) : (
            <div className="mx-auto h-40 w-40 animate-pulse rounded-lg bg-line" />
          )}
          <p className="mt-2 max-w-[18ch] text-xs text-ink-mute">{t("book.showQr")}</p>
        </div>
      </div>

      <Button className="mt-5" variant="outline" onClick={onDone}>{t("book.newBooking")}</Button>
    </Panel>
  );
}
