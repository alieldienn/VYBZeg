-- =============================================================================
-- VYBZ: starter Daily Vibe prompts, one per day starting 2026-10-18.
-- The app shows the newest prompt whose date has arrived (Egypt time), so if
-- this list runs out the last prompt simply stays up. Add more any time with:
--   insert into public.daily_prompts (emoji, prompt_text, active_date)
--   values ('🌙', 'Your prompt here', '2026-11-17');
-- =============================================================================

insert into public.daily_prompts (emoji, prompt_text, active_date)
select p.emoji, p.prompt_text, date '2026-10-18' + p.day
from (
  values
    (0, '🍽️', 'What''s on your plate?'),
    (1, '🏆', 'Small win of the day'),
    (2, '🎧', 'Song stuck in your head today?'),
    (3, '🌶️', 'Drop your hottest take'),
    (4, '📍', 'Show us the view from where you are right now'),
    (5, '🌙', 'Plans for tonight?'),
    (6, '☕', 'Your drink of the day'),
    (7, '👟', 'Outfit check'),
    (8, '🚗', 'The commute today, honestly'),
    (9, '📚', 'What are you learning right now?'),
    (10, '😂', 'Funniest thing that happened today'),
    (11, '🌅', 'Catch the sunset (or sunrise) wherever you are'),
    (12, '🛋️', 'Your comfiest corner'),
    (13, '🎮', 'What are you playing / watching lately?'),
    (14, '🫶', 'Shout out someone who made your day'),
    (15, '🥙', 'Best street food near you'),
    (16, '📸', 'A photo that sums up your week'),
    (17, '🧠', 'One thing you changed your mind about'),
    (18, '🌿', 'Something green near you'),
    (19, '🎯', 'One goal for this week'),
    (20, '🐱', 'Pets of VYBZ: show us yours (or a street cat)'),
    (21, '🏙️', 'Your favourite spot in your city'),
    (22, '🎂', 'Last thing that made you feel like a kid'),
    (23, '🔥', 'Unpopular opinion, go'),
    (24, '🌊', 'Dream trip this summer?'),
    (25, '🍿', 'Movie night pick'),
    (26, '✏️', 'Draw or write something, anything'),
    (27, '🕰️', 'What were you doing at 9pm?'),
    (28, '💬', 'Best thing a friend said to you recently'),
    (29, '✨', 'Proudest moment this month')
) as p(day, emoji, prompt_text)
on conflict (active_date) do nothing;
