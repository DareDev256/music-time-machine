// /admin: the moderation queue for "Remembered by listeners". Phone-first; plain HTML forms so
// approving works with no client JS. Signed in once per device by POSTing the key from the form below (see api/admin/auth.ts).

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { ADMIN_COOKIE, isAdminCookie } from "@/app/api/admin/auth";
import { VERDICT_LABEL, type Verdict } from "@/lib/era/verdict";
import s from "./admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moderation · Was Playing",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

interface Row {
  _id: string;
  song: string;
  artist: string;
  month: string;
  note?: string;
  link?: string;
  status: "pending" | "approved" | "rejected";
  evidence: { known: { source: string; date: string; label: string }[]; earliest?: string; verdict: Verdict };
  createdAt: number;
  reviewedAt?: number;
  reviewNote?: string;
}

const SOURCE_LABEL: Record<string, string> = { index: "Own index", musicbrainz: "MusicBrainz", itunes: "Apple Music" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const when = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function monthLabel(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1] ?? "?"} ${m.slice(0, 4)}`;
}

function one(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function Chip({ verdict }: { verdict: Verdict }) {
  return <span className={`${s.chip} ${s[`chip_${verdict.replace(/-/g, "_")}`] ?? ""}`}>{VERDICT_LABEL[verdict] ?? verdict}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={s.page}>
      <header className={s.mast}>
        <span className={s.word}>Was<b>·</b>Playing</span>
        <span className={s.mastLabel}>Moderation</span>
      </header>
      {children}
    </main>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  // Old ?key= links are ignored: a token in a URL lands in request logs and browser history.
  if (one(sp.key)) redirect("/admin");

  const jar = await cookies();
  if (!isAdminCookie(jar.get(ADMIN_COOKIE)?.value)) {
    return (
      <Shell>
        <section className={s.signedOut}>
          <h1 className={s.h1}>Sign in</h1>
          <form method="post" action="/api/admin/session" className={s.signIn}>
            <label htmlFor="admin-key" className={s.dim}>Moderator key</label>
            <input id="admin-key" name="key" type="password" autoComplete="current-password" required minLength={32} className={s.keyInput} />
            <button type="submit" className={s.approve}>Sign in</button>
          </form>
          {one(sp.error) === "key" && <p className={s.dim}>That key didn&rsquo;t match.</p>}
        </section>
      </Shell>
    );
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CONVEX_SERVER_SECRET;
  let pending: Row[] = [], recent: Row[] = [], loadError: string | null = null;
  if (!url || !secret) loadError = "Storage is not configured (NEXT_PUBLIC_CONVEX_URL / CONVEX_SERVER_SECRET).";
  else {
    try {
      const res = (await new ConvexHttpClient(url).query(api.submissions.adminList, { secret })) as { pending: Row[]; recent: Row[] };
      pending = res.pending;
      recent = res.recent;
    } catch {
      loadError = "Couldn't load the queue from storage. Reload to try again.";
    }
  }
  const error = one(sp.error)?.replace(/[^\w .,'-]/g, "").slice(0, 120) || null;

  return (
    <Shell>
      <div className={s.summary}>
        <h1 className={s.h1}>{pending.length} waiting</h1>
        <span className={s.dim}>Newest first. Approved ones go live on their month&rsquo;s era page.</span>
      </div>
      {error && <p className={s.alert} role="alert">{error}</p>}
      {loadError && <p className={s.alert} role="alert">{loadError}</p>}

      {!loadError && pending.length === 0 && <p className={s.empty}>Nothing waiting. New submissions land here.</p>}

      <ol className={s.queue}>
        {pending.map((r) => (
          <li key={r._id} className={s.item}>
            <div className={s.itemHead}>
              <span className={s.claim}>Hot in <b>{monthLabel(r.month)}</b></span>
              <Chip verdict={r.evidence.verdict} />
            </div>
            <h2 className={s.song}>{r.song}</h2>
            <span className={s.artist}>{r.artist}</span>
            {r.note && <p className={s.note}>&ldquo;{r.note}&rdquo;</p>}
            {r.link && (
              <a className={s.link} href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc">{r.link}</a>
            )}

            <div className={s.evidence}>
              <span className={s.label}>What the check found</span>
              {r.evidence.known.length ? (
                <ul className={s.known}>
                  {r.evidence.known.map((k) => (
                    <li key={`${k.source}-${k.date}`} className={k.date === r.evidence.earliest ? s.earliest : undefined}>
                      <span className={s.kDate}>{k.date}</span>
                      <span className={s.kWhat}>
                        <span className={s.kSource}>{SOURCE_LABEL[k.source] ?? k.source}</span>
                        <span className={s.dim}>{k.label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.dim}>No date found in the own index, MusicBrainz or Apple Music.</p>
              )}
              {r.evidence.earliest && <span className={s.dim}>Earliest known: {r.evidence.earliest}. Claimed: {r.month}.</span>}
            </div>

            <form className={s.form} method="post" action="/api/admin/review">
              <input type="hidden" name="id" value={r._id} />
              <label className={s.noteField}>
                <span className={s.label}>Note for the record (optional)</span>
                <input name="note" maxLength={280} autoComplete="off" />
              </label>
              <div className={s.buttons}>
                <button className={s.approve} name="decision" value="approved" type="submit">Approve</button>
                <button className={s.reject} name="decision" value="rejected" type="submit">Reject</button>
              </div>
            </form>
            <span className={s.meta}>Sent {when.format(r.createdAt)}</span>
          </li>
        ))}
      </ol>

      {recent.length > 0 && (
        <section className={s.recent} aria-labelledby="recent">
          <h2 id="recent" className={s.h2}>Recently reviewed</h2>
          <ul className={s.recentList}>
            {recent.map((r) => (
              <li key={r._id}>
                <span className={r.status === "approved" ? s.statusOk : s.statusNo}>{r.status}</span>
                <span className={s.recentWhat}>
                  <span className={s.recentSong}>{r.song}</span>
                  <span className={s.dim}>{r.artist} · {monthLabel(r.month)}{r.reviewNote ? ` · ${r.reviewNote}` : ""}</span>
                </span>
                <span className={s.meta}>{r.reviewedAt ? when.format(r.reviewedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
