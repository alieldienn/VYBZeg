# VYBZ

A Gen Z social app for sharing everyday moments with friends, keeping private circles, and making plans together. Launching in Egypt first.

> **Status: Milestone 1, frontend only.** Everything runs on realistic sample data. Nothing is saved, uploaded or sent to anyone, and the app resets when you refresh the page.

## Run it

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
| `/`             | Home: Daily Vibe prompt, friends' feed, reactions, filters    |
| `/post`         | Create a photo or text post, choose a prompt and audience, preview and publish |
| `/circles`      | Your private circles, plus "New circle"                       |
| `/circles/[id]` | Circle detail: members, invites, plans, posts, activity, weekly recap preview |
| `/plans`        | Plan polls: vote, lock in a plan, create a new plan           |
| `/profile`      | Profile, edit profile, profile photo, settings                |

## Project structure

```
src/
  app/                 Pages (one folder per route) + global styles
  components/
    brand/             Logo
    layout/            Sidebar (desktop), bottom tab bar (mobile), page header
    ui/                Reusable building blocks: Button, Avatar, Sheet, Switch…
    feed/ post/ circles/ plans/ profile/   Feature components for each screen
  lib/
    types.ts           Data shapes (User, Post, Circle, Poll…)
    sample-data.ts     Fake data. To be replaced by Supabase queries
    store.tsx          In-memory app state shared by all screens
    constants.ts       Reactions, colours, plan categories, limits
    utils.ts           Small helpers
public/samples/        Sample photos (credits in CREDITS.md)
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

## What is simulated in this milestone

- Posting, reacting, voting, invites, new circles/plans and settings only live in memory on your device.
- Picked photos are shown from a temporary in-browser link; nothing is uploaded.
- Invite links use a placeholder address (`vybz.example`).
- Light mode, Arabic, log out and the Weekly Recap are marked "soon".

## Tech

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Lucide icons.
Planned: Supabase (auth, database, storage) and Vercel (hosting).
