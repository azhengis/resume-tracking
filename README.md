# resume check

Personal, single-user tool: paste a resume + a job description, get a full ATS-style
evaluation from an LLM agent, and track applications in a lightweight tracker.

- **Evaluate** — paste your resume and a job description (+ company/title/link), run the
  evaluation. It runs the full ATS-evaluator prompt (`lib/ats-prompt.ts`) against the model.
- **Tracker** — save any evaluation to a table (company, role, link, status, date, notes),
  with the exact resume/JD/report snapshot from that run.
- **About you** — free-form context about your background/goals, sent to the agent as
  extra context on every evaluation.

All app data (resume, about-you context, tracker entries) lives in the browser's
`localStorage` — nothing is stored server-side, nothing needs a database. Only the
resume/JD/context text is sent to the model when you click "Run evaluation".

## Setup

This project is linked to a Vercel project (`vercel link`), which pulled a
`VERCEL_OIDC_TOKEN` into `.env.local` — that's what authenticates AI Gateway calls, both
locally (`npm run dev`) and when deployed. No `AI_GATEWAY_API_KEY` needed.

1. **Add a credit card to the Vercel account** at
   [vercel.com → AI → Add a card](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card).
   The AI Gateway refuses all requests, even free-credit ones, without a card on file —
   this is the one real blocker before evaluations will work at all.
2. Install and run:

   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000).

The OIDC token in `.env.local` expires periodically — if evaluations start failing with
auth errors after a while, run `vercel link` again (or `vercel env pull`) to refresh it.

## Deployed copy

Also deployed at Vercel, at a stable link:

**https://resume-screening-nu-sable.vercel.app**

Vercel's own deployment protection (SSO/password) can't cover a stable alias on the
Hobby plan, so instead the app gates itself: `proxy.ts` (Next's middleware convention)
checks a signed cookie against the `APP_PASSWORD` env var on every request, and
`/login` + `/api/login` issue that cookie. Vercel's SSO protection is turned off for
this project since it would just add a redundant login in front of this one.

The passphrase lives only in `.env.local` (gitignored) and in the Vercel project's
encrypted env vars — never in this repo. To see or rotate it:

```bash
vercel env ls                       # confirm APP_PASSWORD is set (value hidden)
vercel env rm APP_PASSWORD production preview   # remove old value
printf 'new-passphrase' | vercel env add APP_PASSWORD production
printf 'new-passphrase' | vercel env add APP_PASSWORD preview
```

To ship a change to the stable link (env var changes and code changes both need a
fresh deploy, and the alias has to be re-pointed since `vercel deploy` always creates a
new URL):

```bash
vercel deploy
vercel alias set <the-new-deployment-url-it-printed> resume-screening-nu-sable.vercel.app
```

## Notes

- Model used is `openai/gpt-4.1` via the Vercel AI Gateway (`app/api/evaluate/route.ts`) —
  chosen because it's free-tier eligible (no AI Gateway credit purchase required, just
  the card-on-file check). Claude models are gated behind a paid-tier purchase on the
  Gateway; swap the model string there if that ever changes or you'd rather pay for
  Claude quality. Check `https://ai-gateway.vercel.sh/v1/models` for what's currently
  free-tier eligible before switching.
- The evaluation is a 3-stage pipeline (`lib/ats-prompt.ts`: analysis → tailored resume →
  final review), run as three sequential requests so each stage stays focused and none of
  them silently truncate. The UI shows each stage's result as it completes.
- Uploading a PDF resume detects its font category (serif/sans-serif/monospace) from the
  actual embedded fonts (`app/api/parse-resume/route.ts`, via `unpdf`) and stores it
  alongside the extracted text. "Download PDF" (`app/api/generate-pdf/route.ts`, via
  `pdf-lib`) renders the tailored resume text into a fresh PDF in that same font family —
  it's a regenerated document, not an edit of the original file, since real PDF content
  streams don't reflow when the text length changes.
- Because everything is `localStorage`-backed, data is per-browser. If you want it to
  follow you across devices, that'd mean adding real persistence (a database) — not set
  up here since this was built as a single-browser personal tool.
