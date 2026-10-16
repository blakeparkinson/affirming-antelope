# Tracking plan (PostHog)

One PostHog project for the website (`affirmingantelope.com`), the learner app (web at
`app.affirmingantelope.com`, iOS/Android later), and the trainer dashboard (`/trainer`).
Event names and property types live in `packages/core/src/analytics.ts` so every surface
uses the same vocabulary. Snake_case, `object_verb` past tense.

## Privacy rules (non-negotiable)

- **Never send content.** No transcript text, learner replies, reflections, notes to
  trainers, trainer feedback, audio, or free-text inputs. Ids and enums only.
- **No PII.** Never send email or display names. Identify signed-in people by their
  Supabase user uuid only.
- **Anonymous users are not identified.** Every app user now has a Supabase uid from
  first launch (guests are anonymous users), but `identify` runs only for permanent
  users: on conversion (same uid, `verifyOtp` `email_change`) and on sign-in to an
  existing account. Guests stay on PostHog's device id; identifying on conversion links
  their earlier events. See [anonymous-auth.md](anonymous-auth.md#analytics-identity).
- **Website is cookieless:** `persistence: 'memory'`, no cookies or local storage, so no
  consent banner. A visitor's anonymous id travels to the app only through the CTA link
  (`?ph_did=<id>&ph_sid=<session>`), and the app bootstraps PostHog with it.
- **App** persists its anonymous id in local storage / AsyncStorage (needed for retention).
- **Session replay off.** Autocapture on the website only (clicks on `[data-track]`
  elements and links); off in the app and dashboard, where we send explicit events.
- Respect Do Not Track / Global Privacy Control: if set, don't initialise.
- Vercel Web Analytics also runs on the website (`<Analytics />` in the root layout): page views only, cookieless, served first-party from `/_vercel/insights`. PostHog stays the source of truth for events and funnels.
- Ingest through a first-party proxy: `https://affirmingantelope.com/ingest` (Next
  rewrites to `us.i.posthog.com` / `us-assets.i.posthog.com`).

## Env

- Web: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=/ingest` (proxy), `NEXT_PUBLIC_POSTHOG_UI_HOST=https://us.posthog.com`
- App: `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST=https://affirmingantelope.com/ingest`
- No key → analytics is a no-op (local dev, tests).

## Super properties (on every event)

`surface`: `'website' | 'app' | 'trainer'`, `platform`: `'web' | 'ios' | 'android'`,
`app_version`, `signed_in`: boolean (true only for permanent users; an anonymous session is `false`).

## Person properties (signed-in only)

`role`: `'learner' | 'trainer'`, `is_trainer`: boolean, `cohort_count`: number,
`signed_up_at`: ISO date, `pathway_id`: `'mi-for-leaders' | 'mi-for-clinicians'` (the active
track). Set on sign-in / when they change (`pathway_id` also when a track is picked).

## Website events

| event | properties | when |
|---|---|---|
| `$pageview` | (auto, incl. UTM + referrer) | every page |
| `cta_clicked` | `location` (`hero`, `nav`, `download_band`, `trainer_pilot`, `faq`, `audience_<x>`, `guide_<slug>`, `guide_index`, `footer`), `target` (`app`, `trainer`, `pilot`: the 30-minute pilot booking call on Calendly), `audience?` (`clinicians`, `leaders`, `trainers`) | any primary CTA, via `data-track` attributes |
| `guide_drill_clicked` | `slug`, `drill_id` | "Try this drill" inside a guide |

## Learner app events

| event | properties |
|---|---|
| `app_opened` | `entry` (`direct`, `website_cta`, `guide`, `deep_link`), `src?` (CTA location) |
| `onboarding_chosen` | `choice` (`guest`, `sign_in`) |
| `sign_in_started` | `reason` (`welcome`, `cohort`, `review`, `me`, `quota`: a guest at today's free AI limit) |
| `sign_in_completed` | `is_new_user`, `migrated_guest_data` (conversion: always the same uid; existing account: merge-anonymous moved rows) |
| `signed_out` | — |
| `guest_started_over` | — |
| `practice_started` | `kind` (`drill`, `roleplay`, `lesson`), `ref_id`, `skill?`, `level?`, `source` (`today`: the daily rep, `assignment`, `path`, `practice_tab`, `challenge`, `guide`, `review_recommendation`, `next_step`, `refresh`: Home's Keep it sharp card), `pathway_id`, `mode` (`text`, `voice`: role-play Talk mode; drills and lessons are `text`). Role-play sends it when the conversation starts (the brief's START), since that's where Talk or Type is picked |
| `drill_answered` | `drill_id`, `skill`, `level`, `format` (`choice`, `text`), `hit_target` |
| `drill_feedback_received` | `drill_id`, `latency_ms`, `move`, `hit_target` |
| `roleplay_turn_sent` | `scenario_id`, `turn_index` |
| `voice_turn_recorded` | `scenario_id`, `duration_ms` (a spoken turn sent for transcription; never the audio or the words) |
| `voice_transcribe_failed` | `reason` (`no_speech`, `permission`, `unavailable`, `rate_limited`, `too_large`, `offline`, `server`) |
| `roleplay_ended` | `scenario_id`, `learner_turns`, `ended_early` |
| `reflection_submitted` | `scenario_id`, `feeling` |
| `debrief_viewed` | `scenario_id`, `latency_ms`, `suggested_next_step`, `pathway_id` |
| `next_step_chosen` | `from` (`drill`, `debrief`, `lesson`), `choice` (`try_again`, `same_skill`, `harder`, `new_scenario`, `one_more`, `done`) |
| `practice_completed` | `kind`, `ref_id`, `skill?`, `minutes`, `activity_id?`, `in_course`, `pathway_id` |
| `streak_extended` | `streak_days` |
| `streak_milestone_reached` | `milestone` (3, 7, 14, 30, 50 or 100), `streak_days` (after the practice). Sent by the device whose practice crossed it, when the milestone moment queues. Once per milestone per streak run: the celebration is written to the synced document, so another device doesn't send it again |
| `weekly_goal_hit` | `target` |
| `streak_freeze_used` | `freezes_used` (missed days covered by this use), `freezes_held` (after), `streak_days` (the streak it protected), `saved` (false when a later missed day broke the streak anyway). Sent by the device that records the use, when Home opens or on the next practice |
| `streak_freeze_earned` | `freezes_held` (after), `at_cap` (already holding 2, so the hit earned nothing). Sent with `weekly_goal_hit`, at most once a week |
| `reminder_prompt_shown` | `ask` (1 after the first practice, 2 after the third) |
| `reminder_opt_in` | `source` (`offer`, `me`), `hour`, `minute` |
| `reminder_declined` | `source` (`offer`, `me`), `reason` (`not_now`, `permission_denied`) |
| `reminder_opened` | `kind` (`daily`, `streak`, `last_call`, `lapse`) |
| `reminder_settings_changed` | `on`, `hour`, `minute` |
| `daily_rep_shown` | `drill_id`, `skill`, `done` (today's rep already practiced, so the card offers one more), `pathway_id`. Once per drill and state a day, however often Home opens |
| `daily_rep_started` | `drill_id`, `skill`, `entry` (`home`, `reminder`: a tapped reminder opened it), `one_more` (a further drill after today's rep), `pathway_id`. The drill then sends `practice_started` with `source` `today` |
| `skill_faded_shown` | `skill`, `level`, `sharpness` (0..1, two places), `days` (whole days since the skill was last practised), `faded` (how many skills are faded). Home's Keep it sharp card, for the least sharp faded skill. Once per skill a day, however often Home opens |
| `skill_refreshed` | `skill`, `level`, `sharpness` (before the practice), `days`, `kind` (`drill`, `roleplay`, `lesson`). Any practice of a faded skill, from any entry point; the practice restores its sharpness |
| `cohort_joined` | `cohort_id` |
| `pathway_chosen` | `pathway_id` (`mi-for-leaders`, `mi-for-clinicians`), `source` (`onboarding`, `me`, `cohort`) |
| `submission_created` | `kind`, `ref_id` |
| `submission_withdrawn` | — |
| `review_viewed` | `rating?`, `has_audio`, `try_again` |
| `ai_request_failed` | `endpoint` (`turn`, `debrief`, `drill`), `status` |

## Trainer dashboard events

| event | properties |
|---|---|
| `trainer_signed_in` | `is_new_user` |
| `trainer_access_claimed` | — |
| `trainer_access_requested` | `request_id`, `learner_count` (`1-10`, `11-30`, `31-100`, `100+`). Sent from "Become a trainer"; never the name, organization or note |
| `trainer_access_approved` | `request_id`. Sent by the admin who approves it at `/trainer/admin` |
| `cohort_created` | — |
| `join_code_copied` | — |
| `assignment_created` | `item_count`, `kinds` (array), `due_in_days` |
| `review_opened` | `hours_since_submitted` |
| `review_saved` | `rating?`, `has_audio`, `has_recommendation`, `try_again`, `is_edit` |

## Dashboards to build in PostHog

1. **Acquisition funnel:** `$pageview` (website) → `cta_clicked` → `app_opened` →
   `practice_completed` (first) → `sign_in_completed` → `cohort_joined`. Breakdown by UTM
   source, landing page, `audience`.
2. **Activation:** % of `app_opened` with a `practice_completed` within the session.
3. **Retention:** weekly retention on `practice_completed`.
4. **Practice loop health:** `roleplay_ended.ended_early` rate, `debrief_viewed.latency_ms` p50/p90,
   `next_step_chosen` mix (dead ends = sessions ending at debrief).
5. **Trainer activation:** `trainer_signed_in` → `trainer_access_requested` → `trainer_access_approved` (or `trainer_access_claimed`) → `cohort_created` → `assignment_created` →
   `review_saved`; time from `submission_created` to `review_saved`.
6. **Content:** guide pageviews → `guide_drill_clicked` → `practice_completed` with `source = guide`.
7. **Daily rep:** `daily_rep_shown` (`done = false`) → `daily_rep_started` → `practice_completed`, broken down by
   `entry`; `reminder_opened` → `daily_rep_started` with `entry = reminder`; `one_more` share.
8. **Spaced review:** `skill_faded_shown` → `practice_started` with `source = refresh` → `skill_refreshed`; also
   `skill_refreshed` from other entry points (a daily rep on a faded skill), by `days` faded.
