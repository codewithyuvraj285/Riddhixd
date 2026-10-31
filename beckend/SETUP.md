# Riddhix chatbot backend: setup (about 15 minutes)

The website is static (GitHub Pages is fine). The AI and Google Sheets work happens in a **Google Apps Script Web App**
(`backend/Code.gs`) that runs under your Google account. No secret ever goes into the website files.

## 0. Check your spreadsheet first
Your link has `rtpof=true`, which usually means the file is an uploaded **.xlsx stored in Drive**, not a native Google Sheet.
Apps Script cannot write to it until it is converted: open it, **File -> Save as Google Sheets**, and use the new copy.
I could not open your sheet from my environment, so the code reads your real headers at runtime instead of assuming them (see "How it adapts").

## 1. Create the script
1. Go to https://script.google.com -> **New project**. Name it "Riddhix Chat Backend".
2. Replace the contents of `Code.gs` with `backend/Code.gs`.
3. Project Settings -> tick **Show "appsscript.json" manifest file**; replace it with `backend/appsscript.json` (sets Asia/Kolkata).
4. Project Settings -> **Script properties** -> add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | the long ID in your sheet URL between `/d/` and `/edit` |
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com (only ever stored here) |
| `MODEL` | optional; default `claude-sonnet-5-5`. Change if your account uses another model |
| `CLIENT_TOKEN` | optional random string; if set, put the same value in `js/config.js` -> `clientToken` |
| `NOTIFY_EMAIL` | address(es) that get a copy of each finished enquiry, comma-separated, e.g. `siddhiworki830@gmail.com` (add `info@riddhix.com` after a comma if you want both) |
| `DAILY_AI_LIMIT` | optional; max AI calls per day (default 500). This caps your API bill |
| `GLOBAL_PER_MIN` | optional; max requests per minute across all visitors (default 120) |

5. Select `checkSetup` in the toolbar -> **Run**. Approve the Google permissions. The log must list your three tab names.

## 2. Deploy
**Deploy -> New deployment -> Web app**: Execute as **Me**, Who has access **Anyone**. Copy the `/exec` URL.
(Visitors are anonymous, so "Anyone" is required. The spreadsheet itself is NOT made public; only this script can write to it.)
After any later code change use **Deploy -> Manage deployments -> Edit -> New version**; the URL stays the same.

## 3. Connect the website
Edit `js/config.js`: paste the `/exec` URL into **both** `chatEndpoint` and `leadEndpoint` (same URL), and `clientToken` if you set one.
Visit `<exec URL>` in a browser: you should see `{"ok":true,"service":"riddhix-chat",...}`.

## 4. Publish the site (GitHub Pages, as in README.md)
Upload everything except `backend/` and `tests/` (they are harmless but not needed publicly). Keep `.nojekyll`.

## How it adapts to your sheet
- Tabs are matched by name ignoring case/spaces/punctuation: **All Leads** (or Leads), **Messages**, **Requirements**, optional **Instructions**.
- **Messages** is the single message log for all visitors (one row per message, never one sheet per client). If it does not exist it is created with these columns: Timestamp, Client ID, Conversation ID, Client Name, Client Email, Sender, Message Text, Page URL, Message ID (Message ID is the key that prevents duplicate rows on retries; do not delete it). An older **Chat History** tab is no longer used and is never modified or deleted; copy its rows into Messages yourself if you want them there.
- Columns are matched by header text (e.g. "Client Name"/"Name", "Date & Time"/"Date"), in any order, and the header row may be any of rows 1-5.
- A missing **tab** is created with the standard headers. A missing **column** is skipped and reported in the response `setup_notes` (never silently).
- If **Lead Status** has a dropdown, the first value starting with "New" is used for new leads. Otherwise `New`.
- **Instructions** tab text (up to 4000 chars) is added to the AI's prompt.
- Existing rows are updated, never duplicated. Status, Priority, Assigned Person and Follow-up Date are only filled when blank, so your team's edits are never overwritten.
- Conventions I chose (change in `Code.gs` if yours differ): Sender = `Client`/`Bot`; Report Status = `Draft`, `Final`, `Incomplete - visitor left`, `Draft (no AI report)`; Priority (set at finalize) = High/Medium/Low from how complete the lead is.
- All cells are written as text, so a visitor cannot inject spreadsheet formulas. Timestamps are `yyyy-MM-dd HH:mm:ss` in Asia/Kolkata.

## Security notes (be aware)
- `clientToken` and the honeypot only deter casual spam; anyone can read them in the page source. Real protection is: input validation, size limits, per-conversation (60/hour) and global rate limits, the daily AI cap, and idempotent writes.
- Apps Script cannot read the request Origin, so it cannot restrict by website domain.
- Visitor email/phone are unverified (guest data). Review the privacy wording with your lawyer; the chat tells visitors what is stored.
- Apps Script web apps have Google quotas (concurrency and daily URL-fetch limits). For high traffic, move the same logic to a server/cloud function.

## Testing the backend without deploying
`node backend/test/run-tests.js` runs the real `Code.gs` against an in-memory fake of Sheets/Cache/Lock/UrlFetch (39 tests).
`python3 tests/ui-tests.py` runs the browser tests (needs `pip install playwright` and `playwright install chromium`).

## Messages tab: how it behaves
- **Client ID**: random anonymous ID stored in the visitor's browser (localStorage `riddhix_client_id`); a returning visitor on the same browser keeps it. Clearing site data or using another browser/device gives a new one.
- **Conversation ID** (`CNV-...`): new for each new tab/session and each "Start a new enquiry"; the same for every message of one conversation.
- **Order**: the visitor's row is saved before the AI is called, the bot row right after the reply. If a bot row failed to save, it is re-saved (before the next visitor row) on the next message or at finish; the chat shows "Not saved yet" until a save succeeds.
- **Client Name / Email** are filled from what the visitor has told the bot so far; early rows can be blank. **Page URL** is the page address without the `#...` part.
- Guided mode (no AI) only writes to the sheet when the visitor taps send; it does not log message by message.

## Test procedure (after deploying; do this before telling anyone it is live)
1. Open `<exec URL>` in a browser: `"version":"1.1.0"` confirms the new code is deployed (an older version means you forgot **Edit -> New version**).
2. Open the website, open the chat, send "Test message 1". The bot answers.
3. In the sheet's **Messages** tab you should see two new rows: `Client` (your text) and `Bot` (the exact reply shown), same Client ID, same Conversation ID, the page URL, in that order.
4. Send a second message: two more rows, same IDs. Reload the page and send another: same Client ID. Click the reset button and send: new Conversation ID, same Client ID.
5. Failure check: temporarily put a wrong `SPREADSHEET_ID`, send a message: the chat must show "Not saved yet". Restore the ID.
6. Optional: `node backend/test/run-tests.js` (simulated Sheets) and `python3 tests/ui-tests.py` (browser).

## Email copy of each enquiry
When an enquiry is finished (visitor taps finish, or leaves after 2+ messages, or submits in guided mode) the backend emails the client details, summary, report and the full conversation to `NOTIFY_EMAIL`, with Reply-To set to the visitor's email. It is sent once per conversation outcome (retries do not resend) and a failed email never blocks the sheet save; the response reports it in `notified`. It is NOT sent per message (Gmail allows about 100 emails/day on a free account, 1,500 on Workspace). Mail is sent from the Google account that deployed the script.
After pasting the new `Code.gs` and `appsscript.json`: add `NOTIFY_EMAIL`, run `sendTestEmail` once (approve the new mail permission, check the inbox and spam), then **Deploy -> Manage deployments -> Edit -> New version**. `/exec` should show `"version":"1.2.0"`.
