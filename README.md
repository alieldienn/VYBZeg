# VYBZ

A Gen Z social app for sharing everyday moments with friends, keeping private circles, and making plans together. Launching in Egypt first.

> **Status: Milestone 2 done.** Real accounts, profiles, friends, circles, posts with photos, reactions, comments, daily prompts and plan polls, all saved in Supabase and protected by database security rules. Not deployed online yet.

## Run it

1. Copy `.env.example` to `.env.local` and fill in the two values from the Supabase dashboard (Project Settings → API Keys / Data API). Only the **public** URL and **publishable** key go there, never the secret key.
2. Then:

```bash
npm install     # first time only: downloads the project's packages
npm run dev     # starts the app at http://localhost:3000
```

Other commands:

| Command         | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `npm run lint`  | Checks the code for common mistakes                       |
| `npm run build` | Builds an optimised production version (also type-checks)|
| `npm start`     | Runs the production build (after `npm run build`)         |

## Screens

| Route           | Screen                                                        |
| --------------- | ------------------------------------------------------------- |
| `/signup` `/login` `/forgot-password` `/reset-password` | Accounts (email + password) |
| `/onboarding`   | Pick a username, name and photo after signing up              |
| `/`             | Home: Daily Vibe prompt, feed from your circles, reactions, comments, open plans |
| `/post`         | Create a photo or text post, answer the prompt, choose a circle, publish |
| `/circles`      | Your private circles, circle invites, "New circle"            |
| `/circles/[id]` | Circle detail: members, roles, invites, plans, posts, activity |
| `/friends`      | Add friends by username, accept or decline requests           |
| `/plans`        | Plan polls: create, vote (and change your vote), lock in, delete |
| `/profile`      | Profile, edit profile, profile photo, your vibes, settings, log out |

## How the data is protected

- Every screen talks to Supabase **as the logged-in user**. The database's Row Level Security rules
  (in `supabase/migrations/`) decide what each person can see and change. For example, you only see
  posts and plans from circles you're a member of, and you can only vote as yourself.
- Profile photos are in a public bucket (`avatars`). Post photos are in a **private** bucket
  (`post-images`) and are shown through links that expire after an hour.
- New plans are open for voting for 24 hours, or until their creator locks them in.
- Notifications (the bell on Home) are created only by the database, by triggers on real activity:
  friend requests and accepts, reactions and comments on your vibes, circle invites and joins, new
  plans, votes on your plans and locked-in plans. You only ever see and mark your own.
- `supabase/tests/rls_tests.sql` (98 tests), `supabase/tests/notifications_tests.sql` (44 tests) and
  `supabase/tests/push_tests.sql` check the security rules. Paste one into the Supabase SQL editor and run it: every row should say
  `passed = true`. They clean up after themselves.

## Project structure

```
src/
  app/                 Pages: (auth) = logged-out pages, (app) = the app itself
  components/
    brand/             Logo
    layout/            Sidebar (desktop), bottom tab bar (mobile), page header
    ui/                Reusable building blocks: Button, Avatar, Sheet, Switch…
    auth/ feed/ post/ circles/ friends/ plans/ profile/   Feature components for each screen
  lib/
    types.ts           Data shapes (User, Post, Circle, Poll…)
    store.tsx          App state shared by all screens (your profile, friends, circles)
    social.ts          Friends and circles (Supabase calls)
    posts.ts           Posts, photos, reactions, comments, daily prompts
    polls.ts           Plans and votes
    notifications.ts   Notifications: load, count unread, mark as read
    pwa.ts             Installing as an app, desktop shortcut, offline detection
    hooks/             usePosts, usePolls: each screen's own list of posts or plans
    auth/ profile/     Server actions for accounts and profiles
    supabase/          Supabase clients, generated database types, error messages
    dates.ts           Egypt (Cairo) days and streaks
    constants.ts       Reactions, colours, plan categories, limits
  proxy.ts             Runs before every page: keeps your login fresh, sends logged-out visitors to /login
supabase/
  migrations/          Database tables, security rules, storage buckets, daily prompts
  tests/               Database security tests
```

## Brand

Source of truth: `VYBZ Neon Purple Brand Moodboard.png`. Tagline: **Real friends. More vibes.**

| Token (Tailwind name) | Hex       | Use                                   |
| --------------------- | --------- | ------------------------------------- |
| `brand`               | `#8B5CF6` | Primary Purple: buttons, links        |
| `brand-soft`          | `#A78BFA` | Light Purple: accents, gradients      |
| `glow`                | `#C084FC` | Neon Purple: active states, highlights|
| `canvas`              | `#0B0B0F` | Dark Background                       |
| `elevated`            | `#1A1A22` | Surface: modals, inputs               |
| `line`                | `#2A2A36` | Borders, dividers                     |
| `fg` / `muted`        | `#FFFFFF` / `#A0A0B8` | Text primary / secondary  |
| `success` / `warning` / `danger` | `#22C55E` / `#F59E0B` / `#EF4444` | Status colours |

Colours are defined once in `src/app/globals.css`. Logo files:

- `public/brand/vybz-wordmark.png`: the hand-lettered wordmark (transparent background, cut from the moodboard)
- `public/brand/vybz-app-icon.svg` and `vybz-app-icon-1024.png`: main app icon (purple tile)
- `src/app/icon.svg`: favicon (simple purple V) · `src/app/apple-icon.png`: iPhone home-screen icon

## Install as an app (PWA)

VYBZ can be installed on phones and computers. The app-install pieces:

- `src/app/manifest.ts`: name, colours and icons (`public/icons/`), served at `/manifest.webmanifest`
- `public/sw.js`: the service worker. It only stores an offline screen (`public/offline.html`);
  pages, data and photos always come from the network, so nothing private is kept on the device
- `src/lib/pwa.ts` + `src/components/pwa/`: the Install card (Home), the Install row (Profile → App)
  and the "You're offline" banner

Installing needs HTTPS (or `localhost`), and the service worker only runs in a production build
(`npm run build` then `npm start`).

On computers, installing (Chrome/Edge) also creates a desktop shortcut. The sidebar explains how if the
browser doesn't offer it, and on Mac/Linux it can download a shortcut file. (Windows browsers refuse to
download `.url` shortcut files from websites, so on Windows it explains the browser's install menu and
dragging the address-bar icon to the desktop instead.)

## Themes

Profile → App → Theme: **Dark** (default), **Light**, or **Auto** (follows the phone/computer).
Saved on each device. Colours are tokens in `src/app/globals.css` (`:root[data-theme="light"]`
holds the light values); `src/lib/theme-script.ts` applies the saved theme before the page paints,
so there's no flash.

## Phone notifications (push)

- Profile → Notifications → **Turn on** saves this device (`push_subscriptions`). Switches there
  choose what buzzes your phone (`notification_preferences`); the bell always shows everything.
- When a notification is created, the database asks the Edge Function
  `supabase/functions/send-push` to deliver it. An hourly job (pg_cron) sends the Daily Vibe
  reminder (morning ≈ 9:00, afternoon ≈ 14:00, evening ≈ 20:00, surprise = 10:00–20:00 Cairo time),
  only if you haven't posted that day.
- Logging out switches alerts off on that device.
- iPhone/iPad: alerts only work once VYBZ is installed to the Home Screen (iOS 16.4+).
- Setup (once): the key pair is in two places.
  - Public half: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` (and in your hosting's environment
    variables when you deploy), plus `VAPID_PUBLIC_KEY` in the Edge Function.
  - Private half: Supabase dashboard → Edge Functions → Secrets → `VAPID_PRIVATE_KEY`.
    It must never go in the app's code or in git.
- `supabase/tests/push_tests.sql` tests devices, preferences, queueing and reminders.

## Not built yet (shown in the app as "Coming soon")

- "Customize theme" (your own accent colour).
- Writing: longer stories / journal entries (shown in the post composer, disabled).
- The Weekly Recap (the circle page shows a preview of this week's numbers).
- Arabic.
- Deleting your account. Before adding it, decide what happens to circles you created
  (today they would be left without an owner).
- Changes from friends appear when you open or reload a screen, not live.
- Known gap: when a circle admin deletes someone else's photo post, that photo file stays in
  storage (only the author can delete their files). The app no longer shows it anywhere.

## Tech

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Lucide icons ·
Supabase (auth, Postgres database, storage). Planned: Vercel (hosting).
