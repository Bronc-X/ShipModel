# Lusie Public Frontend Redesign Plan

## Decision

Build a new React + Vite public frontend for `lusie.cn`.

Keep the existing PHP/ThinkPHP business system for login, registration, event entry submission, certificates, membership, and merchant/admin workflows.

The first release should reposition the site from an old activity portal into a clear competition service entry point for China model sport events.

## Product Goal

The new public frontend should help a visitor quickly answer four questions:

1. What competitions are open now?
2. How do I register?
3. Where are the rules, notices, downloads, scores, and certificates?
4. Who do I contact when something goes wrong?

This is the first release success standard. Visual polish matters, but only if it makes these jobs easier.

## Why Upgrade

The current public site has enough content to be useful, but the presentation layer weakens trust and conversion.

- Mobile layout is effectively desktop-first and cramped.
- The homepage mixes many modules without a strong user path.
- `Model学院` is promoted as a core section, but multiple entries lead to an upgrade placeholder.
- News, notices, score announcements, and downloads are not clearly separated.
- Some sections are stale, especially older recap content and social/link panels.
- Several static pages are thin or nearly empty.
- Event list and event detail pages work, but the registration and rule-discovery path is not obvious enough.

The upgrade is justified if the platform will remain the primary official entry for model sport event discovery and registration.

## Non-Goals

- Do not rebuild login.
- Do not rebuild player registration.
- Do not rebuild member registration.
- Do not rebuild event entry submission.
- Do not rebuild certificate generation or downloads.
- Do not rebuild merchant or institution backend.
- Do not build marketplace in release 1.
- Do not build community in release 1.
- Do not build a full course platform in release 1.

## First Release Scope

### Pages

- Home
- Competition center
- Competition detail display page
- News and notices list
- News and notice detail
- Download center
- Registration guide
- FAQ
- Model Academy light version
- About
- Contact
- Privacy policy
- Terms
- Anti-fraud reminder
- Organization structure
- Publicity specification

### Old System Handoffs

These flows should remain on the old system and be linked clearly:

| Flow | Old URL Pattern | New Frontend Behavior |
|---|---|---|
| Login | `/index/common/login.html` | External or same-domain handoff |
| Player registration | `/index/common/registerM40` | Handoff |
| Member registration | `/user/User/apply_register.html?type=1` and `type=2` | Handoff, with login-required explanation |
| Event submission | `/index/Schedule/detail.html?id=...` or existing event workflow | Handoff from new competition detail |
| Merchant login | `/merchants/index/login/ft/cp` | Handoff |
| Certificate view/download | existing old detail/certificate flow | Handoff |

## Information Architecture

```text
Home
  Current competitions
  Quick actions
  Notices
  Registration guide preview
  Results and certificates
  Model Academy preview
  Works and recaps
  Institution entry
  Contact

Competition Center
  Open for registration
  In progress
  Completed
  Maritime model
  Vehicle model
  Architecture model
  Red education theme

News
  Official notices
  Competition news
  Score announcements
  Media and recaps

Support
  Download center
  Registration guide
  FAQ
  Contact
  Anti-fraud reminder

Model Academy
  What to join first
  Event categories
  Equipment basics
  Example works
  Future courses placeholder with real launch wording
```

## Homepage Structure

1. Hero: current main competition, dates, primary action, secondary action.
2. Quick actions: register, download rules, read guide, check scores, get help.
3. Current competitions: status cards for open, running, and completed events.
4. Official notices: high-trust, dated, categorized announcements.
5. How registration works: simple four-step guide.
6. Competition categories: maritime, vehicle, architecture, red education theme.
7. Results and certificates: entry points and recent score announcements.
8. Model Academy: practical learning and equipment guidance, not empty promises.
9. Works and recaps: current or evergreen showcase, not stale 2021/2022 filler.
10. Institution entry: school and club organization path.
11. Contact and service time.

## Content Model

### Competition

```ts
type Competition = {
  id: string;
  title: string;
  category: "maritime" | "vehicle" | "architecture" | "red-theme" | "mixed";
  group: string[];
  status: "open" | "running" | "completed" | "upcoming";
  startAt: string;
  endAt: string;
  registrationUrl: string;
  rulesUrl?: string;
  guideUrl?: string;
  resultUrl?: string;
  certificateUrl?: string;
  imageUrl?: string;
  organizer?: string[];
  summary: string;
};
```

### Article

```ts
type Article = {
  id: string;
  title: string;
  category: "notice" | "news" | "score" | "download" | "guide" | "recap";
  publishedAt: string;
  source?: string;
  coverUrl?: string;
  bodyHtml: string;
  attachments?: Array<{ title: string; url: string; type: "pdf" | "doc" | "image" | "other" }>;
};
```

### FAQ

```ts
type FAQ = {
  id: string;
  topic: "account" | "registration" | "upload" | "review" | "score" | "certificate" | "institution";
  question: string;
  answer: string;
  relatedUrl?: string;
};
```

## Legacy URL Compatibility

The release should avoid breaking known public links.

| Current URL | New Route Strategy |
|---|---|
| `/` | New home |
| `/index/article/index?cid=82` | Redirect or render `/news?category=notice` |
| `/index/article/index?cid=83` | Redirect or render `/news?category=news` |
| `/index/article/index?cid=80` | Redirect or render `/downloads` |
| `/index/article/index?cid=91` | Redirect or render `/faq` |
| `/index/Article/detail.html?id=...` | Redirect or map to `/news/:id` when content is migrated |
| `/index/schedule/index` | Redirect or render `/competitions` |
| `/index/Schedule/detail.html?id=...` | Keep old detail until new display page has matching data |
| `/index/index/js` | Redirect or render `/guide/registration` |
| `/index/index/mod` | Redirect or render `/academy` |
| `/index/common/building` | Replace with real academy placeholder or redirect to `/academy` |
| `/index/about/index` | Redirect or render `/about` |
| `/index/common/contactus` | Redirect or render `/contact` |

## Data Strategy

### Release 1

Use curated JSON or a small static content layer if PHP APIs are not ready.

This keeps scope controlled and lets the frontend ship without waiting on backend changes.

### Release 1.5

Ask the PHP backend to expose read-only JSON endpoints:

```text
GET /api/public/banners
GET /api/public/competitions
GET /api/public/competitions/:id
GET /api/public/articles
GET /api/public/articles/:id
GET /api/public/downloads
GET /api/public/faqs
```

### Release 2

Move to a CMS or admin-managed content system only if manual JSON starts slowing operations.

Do not introduce a CMS in release 1 unless the content team is already ready to operate it.

## Design Direction

The site should feel like an official competition service, not a marketing splash page.

- Use a restrained official palette with strong blue, white, and one accent color.
- Keep event cards dense enough for scanning.
- Make primary actions obvious: register, rules, guide, results.
- Use real competition/model imagery where possible.
- Reduce decorative particle backgrounds and visual noise.
- Treat mobile as a first-class layout.
- Avoid empty sections. If a feature is not ready, show a useful lightweight version.

## Page Requirements

### Home

- Must show the current primary competition above the fold.
- Must expose quick actions for register, rules, guide, score, and help.
- Must show at least three current or important notices.
- Must show at least three competition cards.
- Must not link to empty placeholder pages.

### Competition Center

- Must support filters by status, model category, group, and keyword.
- Must show each event's status, start/end time, category, group, rule link, and action.
- Must distinguish display detail from old-system registration handoff.
- Must work well on mobile.

### Competition Detail

- Must show title, category, group, organizer, time, status, image, rules, guide, results, certificate path, and registration handoff.
- Must explain when the action requires login.
- Must link to old business workflow for submission/certificate until rebuilt.

### News And Notices

- Must separate notices, news, score announcements, downloads, and recaps.
- Must show date, category, source, and attachments.
- Must support old article id mapping where possible.

### Download Center

- Must group documents by competition and type.
- Must make PDFs directly visible without hiding them inside article bodies.

### Registration Guide

- Must be step-based.
- Must include: account creation, real-name verification, choosing competition, uploading work, review, score, certificate.
- Must include PDF/video links when available.

### FAQ

- Must have real entries in these categories: account, registration, upload, review, score, certificate, institution.

### Model Academy Light

- Must start as practical learning content:
  - Which competition should I join first?
  - What equipment is needed?
  - What does a good work look like?
  - How are works judged?
- Future online courses and nearby institutions can be shown as "coming later" only after useful content is already present.

## Suggested Release Plan

### Week 1

- Confirm page scope and content inventory.
- Build route shell, layout, header, footer, design tokens.
- Build home page first pass.
- Build mobile navigation.

### Week 2

- Build competition center.
- Build competition detail display.
- Build news list and news detail.
- Create static content JSON adapters.

### Week 3

- Build download center.
- Build registration guide.
- Build FAQ.
- Build Model Academy light.
- Build about/contact/policy pages.

### Week 4

- Add legacy URL compatibility.
- Run desktop and mobile QA.
- Fix content gaps.
- Verify old-system handoffs.
- Prepare deployment under Apache.

## Agentic Coding Estimate

| Workstream | Estimate |
|---|---:|
| Design system and layout | 3-4 agent days |
| Home | 3-4 agent days |
| Competition center and detail | 4-6 agent days |
| News, notices, downloads | 3-5 agent days |
| Guide, FAQ, Academy, static pages | 3-5 agent days |
| Legacy routing, QA, polish | 3-5 agent days |

Total: 19-29 agent days if implemented to a high visual and interaction standard.

Calendar time: 4-6 weeks with content review and QA.

The earlier 12-18 day estimate is possible only if visual ambition is moderate, content is ready, and backend/API work is minimal.

## Success Metrics

- A new visitor can find a current competition in under 10 seconds.
- A new visitor can find rules/downloads in under 15 seconds.
- A new visitor can understand the registration process without calling support.
- Mobile pages do not require horizontal scrolling.
- No homepage card links to an empty placeholder.
- Old important URLs do not 404.
- Official notices and score announcements are visibly separated.
- Support contact and service time are visible from guide and FAQ.

## Risks

### Risk 1: Content is not ready

Empty sections will make a new frontend feel fake.

Mitigation: build fewer sections, but make every section useful.

### Risk 2: Old links break

Search engines, schools, and prior notices may still use old URLs.

Mitigation: keep redirect and compatibility mapping in the first release.

### Risk 3: Data source is unclear

If frontend depends on scraping old pages, maintenance will be brittle.

Mitigation: release 1 can use curated JSON, but release 1.5 should add read-only PHP APIs.

### Risk 4: Scope expands into business workflows

Rebuilding registration, membership, or certificates will multiply risk.

Mitigation: keep old-system handoffs explicit in product copy and route design.

### Risk 5: Visual polish hides weak information architecture

A beautiful homepage that still makes rules and registration hard to find is a miss.

Mitigation: make task completion the acceptance standard.

## Recommended Next Step

Approve this as the release 1 boundary, then create a content inventory:

- Current competitions
- Current rules PDFs
- Registration guides
- Latest official notices
- Score announcement links
- FAQ answers
- Contact and service policy

Implementation should start only after the first content inventory exists, because the redesign is content-led.
