# Setting up the demo backend

This branch (`demo`) is a rebranded, sales-demo copy of the CueSheet PWA for
**Apex Pyrotechnics** — a fictional company, used so this can be shown to
prospective clients without exposing any real crew, venue, or payroll data.

The frontend here is fully rebranded and ready. The backend is **not** —
it still needs its own Google Sheet + Apps Script Web App, separate from
production, seeded with made-up data. I can't do this part myself: this
sandbox's network access is blocked from Google's OAuth/Sheets/Apps Script
APIs, so it has to happen in your browser.

## 1. Create a demo copy of the Sheet (keeps the real schema, loses the real data)

1. Open the real Vortex CueSheet Google Sheet.
2. **File → Make a copy**, name it something like `CueSheet DEMO — Apex Pyrotechnics`.
3. Save the copy somewhere outside your main Drive folder structure if you
   want to keep it clearly separate (e.g. a "Demo" folder).
4. In the **copy**, go through each tab (Contacts, Venues, ShowPlans,
   Payroll, Products, Inventory, PickLists, AfterActionReports, Announcements,
   etc.) and **delete all the data rows, keeping the header row**. This is
   the fastest way to get an empty Sheet with the exact right columns,
   without either of us having to hand-reconstruct ~15 tabs' schemas.
5. Add a handful of obviously-fake rows to the tabs you want to show off —
   a few crew names, 2-3 venues, a sample show or two. You don't need much;
   a demo only needs to look alive, not complete. (Easiest way to do this:
   deploy the app first per step 2 below, then use the app's own pages —
   New Hire / Manage pages / Plan a Show / CSV import on Manage Catalog —
   to add sample data through the UI instead of editing the Sheet by hand.)

## 2. Attach the demo code and deploy as a Web App

1. In the demo copy of the Sheet: **Extensions → Apps Script**.
2. Delete whatever's in there, and paste in the contents of
   `apps_script_secure.gs` from this `demo` branch.
3. **Deploy → New deployment → Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone** (same as production — the app's own
     password screens are what gate access)
4. Copy the resulting `/exec` URL.

## 3. Point the frontend at it

Every page in this branch currently has:

```js
const CHECKIN_API_URL = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEMO_APPS_SCRIPT_DEPLOYMENT_ID/exec";
```

Send me that URL and I'll swap it into all ~27 files and push the branch —
or run this yourself from the repo root:

```bash
grep -rl 'REPLACE_WITH_YOUR_DEMO_APPS_SCRIPT_DEPLOYMENT_ID' --include='*.html' --include='*.js' . \
  | xargs sed -i 's#https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEMO_APPS_SCRIPT_DEPLOYMENT_ID/exec#YOUR_NEW_URL_HERE#g'
```

## 4. Go live

GitHub Pages only serves one branch per repo at a time, so to actually show
this at a URL you have two options:

- **Quick/manual:** Repo → Settings → Pages → switch the source branch to
  `demo` right before a client call, switch it back to `main` afterward.
- **Always-on:** merge this branch's files into `main` under a `/demo/`
  subfolder, so the real app and the demo are both live permanently at
  their own paths on the same Pages site. I can do this once the backend
  is wired up, if you'd rather have it always-on.

## Known placeholders left for you to review

- **Utah-specific content**: the venue autocomplete lists (real stadiums,
  schools, cities) and the "Utah Fireworks Act" references in `form.html`,
  `checkin.html`, `payroll.html`, and `qr-codes.html` are still the real
  regional sample data from the original client. I left these alone since
  scrubbing ~40 real venue names felt like a call you should make — say
  the word and I'll genericize them too (or swap in fictional venues).
- **Fire marshal contact block** in `form.html` was changed to an obviously
  fake address/phone (`123 Example Ave`, `(555) 010-0100`) so a demo click
  never emails a real government office.
- **"Staff Approved" catalog badge** — this was "Kurtis Approved" in
  production (named after a specific person); renamed to a generic label
  for the demo.
