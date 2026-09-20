# Running advertising on Skopia

A guide for Advertising and Marketing Officers. Everything here happens in **The
Box Office** — the console at <http://localhost:8080/campaigns>, reachable from the
account menu once an administrator has granted you the marketing role.

---

## The shape of it

A **campaign** is the booking. It has an advertiser, a budget, and the dates it
runs between.

Inside a campaign are **advertisements** — the actual video or image a viewer sees.

Each advertisement is **assigned to targets**: individual titles, or whole
categories. An advertisement with no target is never shown to anybody.

> The dates live on the campaign, not on the advertisement. There is one answer to
> "is this running?" rather than three that can disagree.

---

## Putting a campaign live

**Campaigns → New campaign** walks through it in five steps. Nothing is saved until
the last one, so you can go back freely.

1. **Details** — the campaign name (you will be looking for it in a list later),
   the advertiser, an optional budget, and where the advertisement appears:
   pre-roll, mid-roll, post-roll, overlay, or a lobby standee.

2. **Creative** — upload the video or image. MP4, WebM or MOV, or PNG, JPEG, WebP
   or GIF, up to 50 MB. Skopia works out whether it is a video or a still on its
   own. Add the promotional link — where a click sends the viewer — as a full
   address starting `https://`.

   The preview shows it as a viewer will see it, including the **Advertisement**
   label. That label is always there and cannot be turned off.

3. **Targeting** — choose titles, categories, or both.

   - A **category** reaches every title in it, *including ones published later*.
     The number beside each category is how many titles are in it today.
   - A **title** reaches exactly that one.

   Choosing a category and a title inside it is fine — the viewer still only sees
   the advertisement once.

4. **Schedule** — the start and end dates. The end must fall after the start; the
   form says so before you can continue.

5. **Confirm.** The campaign is now scheduled, and starts on its own.

---

## What the status words mean

| Word | Meaning |
|---|---|
| **DRAFT** | Being written. Never shown to anyone. |
| **SCHEDULED** | Confirmed, waiting for its start date. |
| **ACTIVE** | Running now. |
| **PAUSED** | Held back by somebody. Stops immediately, resumes when you say so. |
| **EXPIRED** | Its end date has passed. |
| **ARCHIVED** | Filed away, out of the working list. |

A campaign moves between SCHEDULED, ACTIVE and EXPIRED **by itself**, from its
dates. You only ever set DRAFT, PAUSED and ARCHIVED.

Occasionally a status has a small dot beside it. That means the dates have moved on
but Skopia's record-keeping has not caught up yet — the word you can see is the one
that counts, and the advertisement is already behaving accordingly. **Review
expired** on the campaigns list tidies the record up at once if you want it neat.

---

## Expired advertisements

**An advertisement stops being shown the moment its campaign's end date passes.**
Not at the end of the day, not when somebody remembers — Skopia checks the dates
every single time it is about to show an advertisement.

So there is nothing you need to do to stop an expired campaign. The banner at the
top of the campaigns list is housekeeping: it tells you which bookings have ended
so you can archive them and keep the list readable.

To bring an ended campaign back, open it and move its end date. A campaign that ran
out while paused has to have its dates extended before it can be resumed — Skopia
will say so rather than quietly doing nothing.

---

## Changing a campaign that is running

Open it from the campaigns list.

- **Pause** stops delivery straight away. **Resume** hands the decision back to the
  dates, so a campaign paused before it ever started comes back as scheduled, not
  running.
- **Targets** can be added or removed at any time. The **×** on a target chip stops
  targeting it.
- **Switch off** on an advertisement stops just that one, leaving the rest of the
  campaign alone.
- **Archive** takes the whole campaign out of the working list.

### Why you cannot delete a campaign that has run

Only a draft can be deleted. Anything that has been shown to somebody is archived
instead, because its impressions and clicks are what last month's report is made
of — deleting it would quietly change a number somebody has already reported.

---

## Reading performance

**Performance** shows every campaign; a campaign's own page shows just that one.

- **Impressions** — times the advertisement was shown.
- **Clicks** — times somebody followed it.
- **CTR** — clicks ÷ impressions, as a percentage. Above 2% is highlighted.

On a campaign's page the same delivery is broken down **by title, by category, by
device, by slot and by advertisement**. Each breakdown adds up to the same total, so
they are five views of one thing rather than five different measurements.

**Export CSV** downloads the figures for the range you are looking at. It opens in
Excel, Numbers or Sheets.

### Two things worth knowing

- An impression is recorded when Skopia *serves* the advertisement, not when the
  viewer's browser reports back. That deliberately counts people who close the tab
  immediately — leaving them out would quietly overstate how well a campaign did.
- A click is counted once per impression, however many times it is clicked, so a
  double-click never bills the advertiser twice.

---

## If something goes wrong

Skopia refuses things for a reason and tells you what it is. The ones you are most
likely to meet:

| It says | It means |
|---|---|
| "The end date must fall after the start date." | Check the two dates in the schedule step. |
| "Add at least one advertisement before confirming." | A campaign with nothing in it would go live and deliver nothing. |
| "Assign this advertisement to a title or a category before activating it." | With no target it would never be shown. |
| "This advertisement already fills that slot on that title." | It is already booked there. Use a different slot, or a different target. |
| "Only a marketing officer can own a campaign." | You are signed in as an administrator. Administrators can read everything but cannot hold a booking. |
| "Could not reach Skopia." | The service is not running. This one is for whoever looks after the server. |

---

## Who can do what

Managing advertising is granted by an **administrator**. Without it, the Box Office
is not reachable at all.

**Administrators** can see every campaign and every figure, but cannot create a
campaign — a booking has to belong to a named marketing officer.
