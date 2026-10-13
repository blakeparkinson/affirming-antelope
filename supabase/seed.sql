-- Local seed (docs/data-model.md "Environments"). Fictional people, test data only.
-- Runs as postgres after migrations on `supabase db reset` / first `supabase start`.
-- Dates are relative to now() so the demo assignment is always due "next Friday".
--
-- Accounts (sign in with email OTP; read the code in Mailpit, http://127.0.0.1:54324):
--   rosa@example.com    Dr. Rosa Lin   trainer (can_train), owns the cohort
--   amanda@example.com  Amanda         learner, submitted PM-017 role-play awaiting review
--   jordan@example.com  Jordan         learner, partway through the assignment
--   priya@example.com   Priya          learner, no recent activity
--   marcus@example.com  Marcus         learner, EN-003 submission already reviewed
-- Cohort join code: MIL-DEMO. Trainer code: TRAIN-PILOT.

-- ---------------------------------------------------------------------------
-- Auth users (+ email identities) so GoTrue's email OTP works for these addresses.
-- The on_auth_user_created trigger creates each profile from display_name metadata.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
  now() - interval '30 days',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  now() - interval '30 days', now() - interval '30 days',
  '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'rosa@example.com', 'Dr. Rosa Lin'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'amanda@example.com', 'Amanda'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'jordan@example.com', 'Jordan'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'priya@example.com', 'Priya'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'marcus@example.com', 'Marcus')
) as u (id, email, display_name);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id, u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email', null, u.created_at, u.created_at
from auth.users u
where u.email like '%@example.com';

update public.profiles set can_train = true where id = '11111111-1111-4111-8111-111111111111';

insert into app_private.trainer_codes (code, note)
values ('TRAIN-PILOT', 'Fall pilot trainers (local seed)');

-- ---------------------------------------------------------------------------
-- Cohort and members
-- ---------------------------------------------------------------------------
insert into public.cohorts (id, name, pathway_id, trainer_id, join_code, starts_on, created_at)
values (
  'c0c0c0c0-0000-4000-8000-000000000001',
  'MI for Leaders — Fall pilot',
  'mi-for-leaders',
  '11111111-1111-4111-8111-111111111111',
  'MIL-DEMO',
  (current_date - interval '28 days')::date,
  now() - interval '30 days'
);

insert into public.cohort_members (cohort_id, user_id, role, joined_at) values
  ('c0c0c0c0-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'trainer', now() - interval '30 days'),
  ('c0c0c0c0-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'learner', now() - interval '28 days'),
  ('c0c0c0c0-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'learner', now() - interval '28 days'),
  ('c0c0c0c0-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'learner', now() - interval '27 days'),
  ('c0c0c0c0-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'learner', now() - interval '26 days');

-- ---------------------------------------------------------------------------
-- Assignment: Week 5 Evoking, due next Friday 5pm Pacific
-- ---------------------------------------------------------------------------
insert into public.assignments (id, cohort_id, title, instructions, due_at, created_by, created_at)
values (
  'a5a5a5a5-0000-4000-8000-000000000001',
  'c0c0c0c0-0000-4000-8000-000000000001',
  'Week 5 Evoking',
  'Listen for the moment someone''s reasons start to shift. Bring one example to our group session.',
  ((current_date + (((5 - extract(isodow from current_date)::int + 6) % 7) + 1)) + time '17:00')
    at time zone 'America/Los_Angeles',
  '11111111-1111-4111-8111-111111111111',
  now() - interval '4 days'
);

insert into public.assignment_items (id, assignment_id, kind, ref_id, skill, quantity, position) values
  ('a5a5a5a5-0000-4000-8000-000000000101', 'a5a5a5a5-0000-4000-8000-000000000001', 'any-drill', null, 'evoking', 2, 0),
  ('a5a5a5a5-0000-4000-8000-000000000102', 'a5a5a5a5-0000-4000-8000-000000000001', 'roleplay', 'EN-003', null, 1, 1);

-- ---------------------------------------------------------------------------
-- Completions. Expected assignment progress (items: 2 evoking drills, EN-003):
--   Amanda 2/2 + 0/1   Jordan 1/2 + 1/1   Priya 0/2 + 0/1   Marcus 2/2 + 1/1
-- ---------------------------------------------------------------------------
insert into public.activity_completions (user_id, client_id, kind, ref_id, activity_id, skill, minutes, completed_at) values
  -- Amanda: week 4 work before the assignment, then two evoking drills and PM-017
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000201', 'learn', 'lesson-u04-focusing', 'u04-a1', 'focusing', 5, now() - interval '9 days'),
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000202', 'drill', 'drill-focusing-01', 'u04-a2', 'focusing', 4, now() - interval '8 days'),
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000203', 'drill', 'drill-focusing-04', 'u04-a3', 'focusing', 3, now() - interval '7 days'),
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000204', 'drill', 'drill-evoking-01', 'u05-a2', 'evoking', 4, now() - interval '2 days'),
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000205', 'drill', 'drill-evoking-03', 'u05-a3', 'evoking', 4, now() - interval '1 day'),
  ('22222222-2222-4222-8222-222222222222', 'ac000000-0000-4000-8000-000000000206', 'roleplay', 'PM-017', null, 'sustain-talk', 12, now() - interval '20 hours'),
  -- Jordan
  ('33333333-3333-4333-8333-333333333333', 'ac000000-0000-4000-8000-000000000301', 'roleplay', 'EN-003', null, 'engaging', 10, now() - interval '2 days'),
  ('33333333-3333-4333-8333-333333333333', 'ac000000-0000-4000-8000-000000000302', 'drill', 'drill-evoking-02', 'u05-a2', 'evoking', 4, now() - interval '27 hours'),
  -- Priya: nothing since the assignment went out
  ('44444444-4444-4444-8444-444444444444', 'ac000000-0000-4000-8000-000000000401', 'drill', 'drill-oars-01', null, 'oars', 3, now() - interval '12 days'),
  -- Marcus
  ('55555555-5555-4555-8555-555555555555', 'ac000000-0000-4000-8000-000000000501', 'drill', 'drill-evoking-04', null, 'evoking', 4, now() - interval '3 days'),
  ('55555555-5555-4555-8555-555555555555', 'ac000000-0000-4000-8000-000000000502', 'drill', 'drill-evoking-05', null, 'evoking', 4, now() - interval '3 days' + interval '1 hour'),
  ('55555555-5555-4555-8555-555555555555', 'ac000000-0000-4000-8000-000000000503', 'roleplay', 'EN-003', null, 'engaging', 11, now() - interval '3 days' + interval '2 hours');

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

-- Amanda: PM-017 role-play, submitted for review.
insert into public.practice_sessions (
  id, user_id, client_id, kind, ref_id, skill, mode, transcript, debrief, self_reflection,
  started_at, ended_at, duration_sec
) values (
  '5e5e5e5e-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  'ac000000-0000-4000-8000-000000000206',
  'roleplay', 'PM-017', 'sustain-talk', 'text',
  $json$[
    {"id": "t1", "speaker": "employee", "text": "So I'm guessing this is about the reports."},
    {"id": "t2", "speaker": "learner", "text": "Partly. Mostly I wanted to check in with you. Things have seemed different for you the last few months."},
    {"id": "t3", "speaker": "employee", "text": "Different how? I'm doing the work. Technically the data's not final until the 5th anyway."},
    {"id": "t4", "speaker": "learner", "text": "The timing is tricky, and you're still getting it done."},
    {"id": "t5", "speaker": "employee", "text": "Sure. I mean, it's a two-day reconciliation every month. I've flagged the template twice."},
    {"id": "t6", "speaker": "learner", "text": "And nobody got back to you. That sounds frustrating, raising it and hearing nothing."},
    {"id": "t7", "speaker": "employee", "text": "Yeah. It is. I guess it feels like nobody's really paying attention to that stuff anymore."},
    {"id": "t8", "speaker": "learner", "text": "What was it like before, back when the reports were going well?"},
    {"id": "t9", "speaker": "employee", "text": "Honestly? Finance used to come to me first. I was the one they counted on. Now I'm the bottleneck."},
    {"id": "t10", "speaker": "learner", "text": "Being someone people can count on really matters to you."},
    {"id": "t11", "speaker": "employee", "text": "It does. I don't want to be that guy who holds everything up."},
    {"id": "t12", "speaker": "learner", "text": "So what would it take to get back on track? Have you thought about blocking off the first week of the month?"},
    {"id": "t13", "speaker": "employee", "text": "Maybe. I don't know. Time isn't really the problem."},
    {"id": "t14", "speaker": "learner", "text": "Fair, I jumped ahead. You said the template is a big part of it. Would it help to look at it together?"},
    {"id": "t15", "speaker": "employee", "text": "Yeah. I could walk you through it. That'd be a start, I guess."}
  ]$json$::jsonb,
  $json${
    "annotations": [
      {"turnId": "t1", "speaker": "employee", "talk": "sustain", "intensity": -1, "stance": "sustain", "note": "Braced for a reprimand."},
      {"turnId": "t2", "speaker": "learner", "move": "simple-reflection", "note": "Named the change without blame."},
      {"turnId": "t3", "speaker": "employee", "talk": "sustain", "intensity": -1, "stance": "sustain", "note": "Defends with logic."},
      {"turnId": "t4", "speaker": "learner", "move": "simple-reflection", "note": "Rolled with the pushback instead of arguing the date."},
      {"turnId": "t5", "speaker": "employee", "talk": "neutral", "intensity": 0, "stance": "ambivalent", "note": "First real detail: the template."},
      {"turnId": "t6", "speaker": "learner", "move": "complex-reflection", "note": "Reflected the frustration under the facts."},
      {"turnId": "t7", "speaker": "employee", "talk": "neutral", "intensity": 0, "stance": "ambivalent", "note": "Opens up about feeling overlooked."},
      {"turnId": "t8", "speaker": "learner", "move": "open-question", "note": "Invited him to look back at what worked."},
      {"turnId": "t9", "speaker": "employee", "talk": "change", "intensity": 1, "stance": "ambivalent", "note": "Pride in being relied on."},
      {"turnId": "t10", "speaker": "learner", "move": "complex-reflection", "note": "Reflected the value under the complaint."},
      {"turnId": "t11", "speaker": "employee", "talk": "change", "intensity": 2, "stance": "change", "note": "Clear desire statement."},
      {"turnId": "t12", "speaker": "learner", "move": "advice-without-permission", "note": "Moved to a fix before he got there."},
      {"turnId": "t13", "speaker": "employee", "talk": "sustain", "intensity": -1, "stance": "sustain", "note": "Pulled back after the suggestion."},
      {"turnId": "t14", "speaker": "learner", "move": "seeking-collaboration", "note": "Owned the jump and handed him the lead."},
      {"turnId": "t15", "speaker": "employee", "talk": "change", "intensity": 1, "stance": "change", "note": "Tentative willingness to start with the template."}
    ],
    "tallies": {
      "openQuestions": 1,
      "closedQuestions": 0,
      "simpleReflections": 2,
      "complexReflections": 2,
      "affirmations": 0,
      "summaries": 0,
      "autonomySupport": 1,
      "miInconsistent": 1
    },
    "trajectory": [-1, -1, 0, 0, 1, 2, -1, 1],
    "reflectionResponse": "You noticed the exact turn that mattered: he opened up when you stopped asking about the deadline, and closed again when the time-blocking idea came in. That's a sharp read of your own conversation.",
    "strengths": [
      "You didn't argue when he said the data isn't final until the 5th. Rolling with it kept him talking.",
      "\"Being someone people can count on really matters to you\" reflected his values, and he answered with his strongest change talk."
    ],
    "keyMoments": [
      {
        "turnId": "t12",
        "observation": "Josh had just said he doesn't want to be the one holding things up. The suggestion to block off time moved to solving before he'd said what he wanted to do.",
        "possibleResponses": [
          "You don't want to be that guy. What would you want finance to say about the reports a few months from now?",
          "That matters to you. What would make it feel worth going the extra mile again?",
          "So part of you is ready for this to be different. Where would you start?"
        ],
        "why": "Reflecting the change talk and asking an evoking question lets him build his own reasons, so any plan is his rather than yours."
      }
    ],
    "tryNext": "When you hear strong change talk, reflect it and ask one evoking question before offering anything.",
    "suggestedNextStep": "same-skill"
  }$json$::jsonb,
  '{"feeling": "mixed", "text": "I think I got him talking once I stopped asking about the deadline. Then I jumped to fixing it and he shut down again."}'::jsonb,
  now() - interval '20 hours' - interval '12 minutes',
  now() - interval '20 hours',
  720
);

-- Amanda: a drill session she did not submit. Trainers must never see this.
insert into public.practice_sessions (
  id, user_id, client_id, kind, ref_id, skill, mode, transcript, debrief, started_at, ended_at, duration_sec
) values (
  '5e5e5e5e-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222222',
  'ac000000-0000-4000-8000-000000000205',
  'drill', 'drill-evoking-03', 'evoking', 'text',
  $json$[
    {"id": "t1", "speaker": "employee", "text": "I mean, I know the team can't close the month without my reports. I don't love being the bottleneck."},
    {"id": "t2", "speaker": "learner", "text": "You care about not holding the team up."}
  ]$json$::jsonb,
  $json${
    "move": "complex-reflection",
    "hitTarget": true,
    "observation": "You picked up the change talk (not wanting to be the bottleneck) and gave it back in your own words.",
    "strength": "Short and specific. It names what he cares about, not what he did wrong.",
    "possibleResponses": [
      "You don't want to be the one holding the team up.",
      "Your work matters to everyone's month-end, and you care about that."
    ],
    "tryNext": "Next time, try ending on the reason to change: \"...and you'd like that to be different.\""
  }$json$::jsonb,
  now() - interval '1 day' - interval '4 minutes',
  now() - interval '1 day',
  240
);

-- Marcus: EN-003 role-play, submitted and reviewed.
insert into public.practice_sessions (
  id, user_id, client_id, kind, ref_id, skill, mode, transcript, debrief, self_reflection,
  started_at, ended_at, duration_sec
) values (
  '5e5e5e5e-0000-4000-8000-000000000003',
  '55555555-5555-4555-8555-555555555555',
  'ac000000-0000-4000-8000-000000000503',
  'roleplay', 'EN-003', 'engaging', 'text',
  $json$[
    {"id": "t1", "speaker": "employee", "text": "Hey. You wanted to see me? Did I mess something up?"},
    {"id": "t2", "speaker": "learner", "text": "Not at all. Nothing's wrong. I just wanted to see how you're doing."},
    {"id": "t3", "speaker": "employee", "text": "Oh. Okay. I'm fine. Just busy, you know."},
    {"id": "t4", "speaker": "learner", "text": "Busy how? Is it the new scheduling system?"},
    {"id": "t5", "speaker": "employee", "text": "No, the system's fine. It's just a lot right now. Honestly, I don't know."},
    {"id": "t6", "speaker": "learner", "text": "It sounds like there's a lot on your plate, and maybe not all of it is here at work."},
    {"id": "t7", "speaker": "employee", "text": "Yeah. My mom moved in with me after she fell. So I've got her meds every night, and I have to get home so my son isn't stuck with her."},
    {"id": "t8", "speaker": "learner", "text": "That's a lot to carry, and you've still been showing up for your patients every day."},
    {"id": "t9", "speaker": "employee", "text": "I try. I don't want it to affect my work. I guess I've just been really tired."}
  ]$json$::jsonb,
  $json${
    "annotations": [
      {"turnId": "t1", "speaker": "employee", "talk": "neutral", "intensity": -1, "stance": "ambivalent", "note": "Worried she's in trouble."},
      {"turnId": "t2", "speaker": "learner", "move": "other", "note": "Honest reassurance up front."},
      {"turnId": "t3", "speaker": "employee", "talk": "neutral", "intensity": -1, "stance": "ambivalent", "note": "Short, guarded answer."},
      {"turnId": "t4", "speaker": "learner", "move": "closed-question", "note": "Guessed at the cause instead of leaving space."},
      {"turnId": "t5", "speaker": "employee", "talk": "neutral", "intensity": 0, "stance": "ambivalent", "note": "\"Honestly, I don't know\": getting closer to something real."},
      {"turnId": "t6", "speaker": "learner", "move": "complex-reflection", "note": "Gently widened the frame beyond work."},
      {"turnId": "t7", "speaker": "employee", "talk": "neutral", "intensity": 1, "stance": "change", "note": "Shares what's really going on."},
      {"turnId": "t8", "speaker": "learner", "move": "affirmation", "note": "Specific affirmation of her care for patients."},
      {"turnId": "t9", "speaker": "employee", "talk": "change", "intensity": 1, "stance": "change", "note": "Names the tiredness; wants work to stay strong."}
    ],
    "tallies": {
      "openQuestions": 1,
      "closedQuestions": 1,
      "simpleReflections": 0,
      "complexReflections": 1,
      "affirmations": 1,
      "summaries": 0,
      "autonomySupport": 0,
      "miInconsistent": 0
    },
    "trajectory": [-1, -1, 0, 1, 1],
    "reflectionResponse": "You said the reflection about her plate felt like the moment it opened up. It was: that's when she told you about her mom.",
    "strengths": [
      "Reassuring her right away that nothing was wrong lowered the stakes.",
      "Your affirmation was specific to her patients, so it landed as true rather than polite."
    ],
    "keyMoments": [
      {
        "turnId": "t4",
        "observation": "After \"just busy,\" the question about the scheduling system offered her an easy answer and briefly steered away from her.",
        "possibleResponses": [
          "Busy, and maybe a bit worn down.",
          "What's been taking up the most room for you lately?",
          "(A pause, letting her fill the space.)"
        ],
        "why": "A reflection or an open question leaves the topic in her hands, which is what lets a guarded person say more."
      }
    ],
    "tryNext": "When the answer is short, try a reflection or a pause before a question.",
    "suggestedNextStep": "same-skill"
  }$json$::jsonb,
  '{"feeling": "solid", "text": "Felt like it opened up once I reflected that there was a lot on her plate. I guessed at the scheduling system too early."}'::jsonb,
  now() - interval '3 days' + interval '2 hours' - interval '11 minutes',
  now() - interval '3 days' + interval '2 hours',
  660
);

-- ---------------------------------------------------------------------------
-- Submissions and the review
-- ---------------------------------------------------------------------------
insert into public.submissions (id, session_id, user_id, cohort_id, note_to_trainer, status, submitted_at) values
  ('5b5b5b5b-0000-4000-8000-000000000001', '5e5e5e5e-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'c0c0c0c0-0000-4000-8000-000000000001',
   'I lost him around the time-blocking question. How would you have handled that moment?',
   'submitted', now() - interval '19 hours'),
  ('5b5b5b5b-0000-4000-8000-000000000002', '5e5e5e5e-0000-4000-8000-000000000003',
   '55555555-5555-4555-8555-555555555555', 'c0c0c0c0-0000-4000-8000-000000000001',
   'First time trying EN-003. Would love feedback on my questions.',
   'submitted', now() - interval '3 days' + interval '3 hours');

-- The reviews_after_insert trigger moves Marcus's submission to `reviewed`.
insert into public.reviews (
  id, submission_id, trainer_id, feedback, rating, recommended_kind, recommended_ref, try_again, created_at, updated_at
) values (
  '7e7e7e7e-0000-4000-8000-000000000001',
  '5b5b5b5b-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'Marcus, the reassurance at the start was just right, and your affirmation about her patients was specific and true. The one place to grow: when Lucia said "just busy," you offered her the scheduling system as an answer. Try a reflection there ("Busy, and maybe worn down") and let her lead. Your reflection in t6 is exactly the move; do more of that, sooner.',
  'developing',
  'drill', 'drill-evoking-03',
  false,
  now() - interval '2 days', now() - interval '2 days'
);

-- ---------------------------------------------------------------------------
-- Amanda's synced app state (shape of apps/mobile/src/state/store.ts LearnerState)
-- ---------------------------------------------------------------------------
insert into public.learner_state (user_id, state, version, updated_at)
values (
  '22222222-2222-4222-8222-222222222222',
  $json${
    "firstName": "Amanda",
    "role": "Director of outpatient nursing",
    "pathwayId": "mi-for-leaders",
    "currentWeek": 5,
    "completedActivityIds": ["u04-a1", "u04-a2", "u04-a3"],
    "skills": {
      "oars": {"level": 2, "percent": 100, "status": "complete"},
      "engaging": {"level": 3, "percent": 40, "status": "in-progress"},
      "focusing": {"level": 2, "percent": 80, "status": "in-progress"},
      "evoking": {"level": 1, "percent": 62, "status": "in-progress"},
      "change-talk": {"level": 1, "percent": 30, "status": "in-progress"},
      "sustain-talk": {"level": 1, "percent": 35, "status": "in-progress"},
      "leadership": {"level": 1, "percent": 60, "status": "in-progress"},
      "discord": {"level": 1, "percent": 0, "status": "locked"},
      "planning": {"level": 1, "percent": 0, "status": "locked"},
      "full-conversation": {"level": 1, "percent": 0, "status": "locked"}
    },
    "weekDays": [true, false, true, true, false, false, false],
    "streak": {"days": 17, "lastPracticeDay": null},
    "weeklyGoal": {"target": 5, "done": 3, "hitCount": 2},
    "scenariosCompleted": 4,
    "practiceLog": [],
    "reviews": [],
    "settings": {"motion": "system", "haptics": true},
    "lastGreetedDay": null,
    "pathSeenWeek": 5
  }$json$::jsonb,
  1,
  now() - interval '20 hours'
);
update public.profiles set display_name_set = true;
