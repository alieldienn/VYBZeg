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
- `supabase/tests/rls_tests.sql` holds 98 security tests. Paste it into the Supabase SQL editor and
  run it: every row should say `passed = true`. It cleans up after itself.

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

## Not built yet

- Notifications and daily reminders (the switches in Settings are marked "soon").
- The Weekly Recap (the circle page shows a preview of this week's numbers).
- Light mode and Arabic.
- Deleting your account. Before adding it, decide what happens to circles you created
  (today they would be left without an owner).
- Changes from friends appear when you open or reload a screen, not live.
- Known gap: when a circle admin deletes someone else's photo post, that photo file stays in
  storage (only the author can delete their files). The app no longer shows it anywhere.

## Tech

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Lucide icons ·
Supabase (auth, Postgres database, storage). Planned: Vercel (hosting).
