import { planBound, type BoundPlan, type Pathway, type PathUnit } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { Celestial, SkyBackdrop, useLighting, Wash } from '@/components/path/Daylight';
import { captionBox, captionGap, captionRoom, layoutBands, layoutLandmarks, layoutTrail, NODE, onSky, SKY_LABEL_PAD, trailPoint, trailRoute, type Pt, type TrailLayout } from '@/components/path/geometry';
import { LANDMARK_ART, landmarkPlan, Landmarks } from '@/components/path/Landmarks';
import { Landscape, motifFor, PALETTES } from '@/components/path/Landscape';
import { Trail } from '@/components/path/Trail';
import { UnitSheet } from '@/components/path/UnitSheet';
import { WeekNode, type WeekNodeHandle } from '@/components/path/WeekNode';
import { Button, Card, CaretDownIcon, CaretUpIcon, FlagPennantIcon, PressableSurface, Text, color, haptic, layout, radius, space } from '@/design';
import { openActivity } from '@/data/routes';
import { Burst, Enter, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { totalWeeks, useActivePathway, useProgress } from '@/state/selectors';
import { useLearner, weekStatus, type WeekStatus } from '@/state/store';

const HEADER = 76;
const MASCOT_H = 104;
const MASCOT_W = MASCOT_H * (674 / 978);
const FLAG = 60;
/** Dust kicked up by the coach's hooves: warm taupe, dark enough to read on the pale sand and sky ridges. */
const DUST = ['#C4A67A', '#B89B70', '#D2BA92', '#A88B62'];

/*
 * Path unlock choreography. Plays once when the screen is focused and
 * `currentWeek > pathSeenWeek` (N-1 → N), then marks the week seen.
 * One UI-thread clock drives the line and the coach; beats cross into React
 * (status swaps, imperative pops, dust, haptics) only when the clock passes them.
 *
 *  lead-in   focus settles (250ms; 850ms on a fresh mount so the trail's own
 *            draw-in finishes); if the N-1→N segment is out of view, a native
 *            animated scroll centres it first (+450ms)
 *  t=30      N-1 lands its check: dip, cobalt → ochre, bouncy overshoot
 *  t=140     the coach bounds along the trail to N (@antelope/core bounds): a crouch,
 *            then 2-3 equal hops that follow the trail's curve, squash on take-off,
 *            stretch in the air, a dust puff on each landing. At take-off N-1's caption
 *            moves back beside its node, and the route leans off the trail away from
 *            the captions, so the coach (drawn in front) never covers a word. The ochre
 *            line draws along beside it, reaching N as it comes down
 *  land-140  N's shackle lifts and swings open
 *  land      last touch-down (~t=1380 for three hops): deeper squash, dust, haptic.thud;
 *            the coach turns to camera and waves
 *  land+300  N pops locked → current (cobalt, bouncy) with haptic.success, breathing
 *            ring starts. Pathway finished instead: the finish flag pops gold
 *  land+560  done (~1.9s): markPathSeen
 *
 * Interruptible: a tap anywhere on the trail skips to the end (no more dust or
 * haptics), node taps are ignored while it runs, a replay can't start on top of
 * itself, the user can grab the scroll at any time. Reduced motion: final state at
 * once, nodes and coach cross-fade, one success haptic.
 * Dev: Me > Demo > Replay path unlock, or antelope://dev/path?replay=1&time=dusk.
 */
const B_CHECK = 30;
const HOP0 = 140;
const BREAK_BEFORE = 140;
const TURN_AFTER = 0;
const OPEN_AFTER = 300;
const DONE_AFTER = 560;
/** Clock value at rest: every beat passed, the coach standing at the current week. */
const REST = 100000;
/** How far (pt) the bound's middle leans off the trail line, away from the captions beside it. */
const DODGE = 40;
const STAGE_FINAL = 6;
const RIM = NODE / 2 - 6;

interface Spot {
  left: number;
  top: number;
  flip: boolean;
  sideRight: boolean;
}

const feetOf = (s: Spot): Pt => ({ x: s.left + MASCOT_W / 2, y: s.top + MASCOT_H });

type BeatKind = 'check' | 'leave' | 'dust' | 'break' | 'land' | 'turn' | 'open' | 'done';
interface Beat {
  t: number;
  kind: BeatKind;
  /** Which landing, for dust. */
  i?: number;
}

/** The unlock's beats on the clock, in order, for a bound planned by `planBound`. */
function unlockBeats(bound: BoundPlan): Beat[] {
  const land = HOP0 + bound.arrive;
  const beats: Beat[] = [
    { t: B_CHECK, kind: 'check' },
    { t: HOP0 + bound.takeoffs[0], kind: 'leave' },
    ...bound.landings.slice(0, -1).map((l, i) => ({ t: HOP0 + l, kind: 'dust' as const, i })),
    { t: land - BREAK_BEFORE, kind: 'break' },
    { t: land, kind: 'land' },
    { t: land + TURN_AFTER, kind: 'turn' },
    { t: land + OPEN_AFTER, kind: 'open' },
    { t: land + DONE_AFTER, kind: 'done' },
  ];
  return beats.sort((a, b) => a.t - b.t);
}

/** Where the coach stands for a week: beside its node on the side with room, or by the finish flag. */
function mascotSpot(trail: TrailLayout, width: number, week: number): Spot {
  if (week > trail.nodes.length) {
    const f = trail.finish;
    return {
      left: f.x - FLAG / 2 - MASCOT_W - 2,
      top: f.y + FLAG / 2 - MASCOT_H + 4,
      flip: true,
      sideRight: false,
    };
  }
  const p = trail.nodes[week - 1];
  const labelLeft = p.x > width / 2;
  const otherRoom = labelLeft ? width - p.x - NODE / 2 : p.x - NODE / 2;
  const sideRight = labelLeft ? otherRoom > MASCOT_W + 6 : !(otherRoom > MASCOT_W + 6);
  return {
    left: sideRight ? p.x + NODE / 2 - 2 : p.x - NODE / 2 - MASCOT_W + 2,
    top: p.y - MASCOT_H + NODE / 2 + 8,
    flip: !sideRight,
    sideRight,
  };
}

/**
 * The active track's path. Keyed by pathway, so switching tracks while Path is
 * mounted re-lays the trail from scratch (node count, landscape, scroll, clock)
 * and never carries one track's unlock into the other.
 */
export default function PathScreen() {
  const pathway = useActivePathway();
  return <PathTrack key={pathway.id} pathway={pathway} />;
}

function PathTrack({ pathway }: { pathway: Pathway }) {
  const total = totalWeeks(pathway);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, layout.maxWidth);
  const focused = useIsFocused();
  const reduce = useReduceMotion();
  const { currentWeek, pathSeenWeek, completedActivityIds: completed } = useProgress();
  const markSeen = useLearner((s) => s.markPathSeen);
  const light = useLighting(reduce);
  // markPathSeen acts on the active track: only ever mark this one
  const markPathSeen = useCallback(() => {
    if (useLearner.getState().activePathwayId === pathway.id) markSeen();
  }, [markSeen, pathway.id]);
  const complete = currentWeek > total;

  const headerH = insets.top + HEADER;
  const visBottom = winH - insets.bottom - layout.tabBarHeight;
  const intro = complete ? 300 : 0;
  const trail = useMemo(() => layoutTrail(width, total, headerH + 150 + intro), [width, total, headerH, intro]);
  const motif = motifFor(pathway.setting);
  // captions as laid out with the coach at its resting week (it moves a caption below its node)
  const captions = useMemo(
    () =>
      pathway.units.map((u, i) => {
        const p = trail.nodes[i];
        const coach = mascotSpot(trail, width, Math.min(currentWeek, total));
        const below = currentWeek === u.week && coach.sideRight === !(p.x > width / 2);
        const current = currentWeek === u.week;
        return captionBox(p, width, { title: u.title, subtitle: current ? u.subtitle : undefined }, below, current);
      }),
    [pathway.units, trail, width, currentWeek, total],
  );
  const landmarks = useMemo(() => layoutLandmarks(trail, landmarkPlan(motif, total), LANDMARK_ART, captions), [trail, motif, total, captions]);
  const bands = useMemo(
    () =>
      layoutBands(
        width,
        trail.finish.y,
        PALETTES[motif],
        motif,
        landmarks.map((l) => l.box),
      ),
    [width, trail.finish.y, motif, landmarks],
  );
  const maxScroll = Math.max(0, trail.height + insets.bottom + layout.tabBarHeight - winH);
  const clampY = useCallback((y: number) => Math.min(maxScroll, Math.max(0, y)), [maxScroll]);

  // ---- unlock state ------------------------------------------------------
  const from = currentWeek - 1;
  const pending = currentWeek > pathSeenWeek && from >= 1;
  const [runStage, setRunStage] = useState<number | null>(null);
  const stage = runStage ?? (pending ? 0 : STAGE_FINAL);
  const statusOf = (week: number): WeekStatus => {
    if (stage >= 4) return weekStatus(week, currentWeek);
    if (week === from) return stage >= 1 ? 'complete' : 'current';
    return weekStatus(week, from);
  };
  const shownComplete = complete && stage >= 4;
  const shownWeek = stage >= 4 ? currentWeek : from;
  const mascotWeek = stage >= 3 ? currentWeek : from;
  // the week whose caption makes room for the coach (none while it is in the air)
  const coachCaptionWeek = stage === 2 ? 0 : mascotWeek;
  const shownIdx = Math.min(shownWeek, total) - 1;

  const yOf = (week: number) => (week > total ? trail.finish.y : trail.nodes[week - 1].y);
  const segTarget = clampY((yOf(Math.max(1, from)) + yOf(currentWeek)) / 2 - (headerH + visBottom) / 2);
  const nodeTarget = (week: number) => clampY(yOf(week) - (headerH + visBottom) / 2 + 20);

  // ---- scroll ------------------------------------------------------------
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // open on the current week (or on the segment that's about to unlock). contentOffset places it
  // before the first paint; a scrollTo issued on mount can land before layout and be dropped,
  // which left a first visit's unlock playing below the fold.
  const [openY] = useState(() => (complete && !pending ? 0 : pending ? segTarget : nodeTarget(currentWeek)));
  const scrollY = useSharedValue(openY);
  const jumping = useSharedValue(-1); // scroll target of a Jump tap, -1 when idle
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onBeginDrag: () => {
      jumping.value = -1;
    },
  });

  // and again once mounted: on iOS the contentOffset is clamped before the trail has laid out,
  // so the first frame painted near the top and the trail jumped a node down on the next one.
  // The trail stays hidden until this scroll has landed, then fades in where it belongs.
  const mountedAt = useRef(Date.now());
  const didScroll = useRef(false);
  const placed = useSharedValue(complete && !pending ? 1 : 0);
  useEffect(() => {
    if (didScroll.current) return;
    // nothing to place (or the unlock finished, e.g. reduced motion, before the timer ran): show it as is
    if (complete && !pending) {
      placed.value = 1;
      return;
    }
    const y = pending ? segTarget : nodeTarget(currentWeek);
    const t = setTimeout(() => {
      didScroll.current = true;
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, y, false);
        placed.value = withTiming(1, { duration: 140, reduceMotion: ReduceMotion.Never });
      });
    }, 30);
    // a re-render inside the 30ms (the header measuring) reschedules with the settled target
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, pending, segTarget, scrollRef]);
  const placedStyle = useAnimatedStyle(() => ({ opacity: placed.value }));

  // ---- the clock ---------------------------------------------------------
  // 0 = the run starts (held there before it plays), REST = at rest (final state).
  const clock = useSharedValue(pending ? 0 : REST);
  const lenA = useSharedValue(0); // N-1 centre (walked before the unlock)
  const lenB = useSharedValue(0); // N-1 rim: the visible draw starts here
  const lenC = useSharedValue(0); // N rim: the visible draw ends here
  const lenD = useSharedValue(0); // N centre (walked after)
  const finalLen = complete ? trail.length : trail.nodeLen[currentWeek - 1];
  useLayoutEffect(() => {
    const a = from >= 1 ? trail.nodeLen[from - 1] : finalLen;
    lenA.value = a;
    lenB.value = from >= 1 ? a + RIM : finalLen;
    lenC.value = from >= 1 ? finalLen - (complete ? FLAG / 2 : RIM) : finalLen;
    lenD.value = finalLen;
  }, [trail, from, finalLen, complete, lenA, lenB, lenC, lenD]);

  // the coach's bound from beside N-1 to beside N, along the trail between them
  const spotFrom = mascotSpot(trail, width, Math.max(1, from));
  const spotTo = mascotSpot(trail, width, currentWeek);
  const spotNow = mascotSpot(trail, width, Math.max(1, mascotWeek));
  const bound = useMemo(() => {
    if (from < 1) return null;
    const a = trail.nodeLen[from - 1];
    const nodeA = trailPoint(trail, a);
    const nodeB = trailPoint(trail, finalLen);
    const fa = feetOf(spotFrom);
    const fb = feetOf(spotTo);
    // captions sit on the side of a node toward the middle; lean the route the other way
    const away = (p: Pt) => (p.x > width / 2 ? 1 : -1) * DODGE;
    const dodge: [number, number] = [away(nodeA), complete ? 0 : away(nodeB)];
    return planBound(trailRoute(trail, a, finalLen, { x: fa.x - nodeA.x, y: fa.y - nodeA.y }, { x: fb.x - nodeB.x, y: fb.y - nodeB.y }, dodge));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail, from, finalLen, width, complete, spotFrom.left, spotFrom.top, spotTo.left, spotTo.top]);
  const beats = useMemo(() => (bound ? unlockBeats(bound) : []), [bound]);
  const beatTimes = useSharedValue<number[]>([]);
  const frames = useSharedValue<number[]>([]);
  const line = useSharedValue<[number, number]>([0, 1]);
  const toX = useSharedValue(spotTo.left);
  const toY = useSharedValue(spotTo.top);
  const mFade = useSharedValue(1);
  useLayoutEffect(() => {
    beatTimes.value = beats.map((b) => b.t);
    frames.value = bound?.frames ?? [];
    // the ochre leaves N-1 as the coach takes off and reaches N just before it lands
    line.value = bound ? [HOP0 + bound.takeoffs[0], HOP0 + bound.arrive - 40] : [0, 1];
    toX.value = spotTo.left;
    toY.value = spotTo.top;
  }, [beats, bound, spotTo.left, spotTo.top, beatTimes, frames, line, toX, toY]);

  const walked = useDerivedValue(() => {
    const t = clock.value;
    const [t0, t1] = line.value;
    if (t <= t0) return lenA.value;
    if (t >= t1) return lenD.value;
    const x = (t - t0) / (t1 - t0);
    const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    return lenB.value + (lenC.value - lenB.value) * e;
  });

  // coach position: always transform-driven so the bound never waits on a re-render. The plan's
  // frames give the feet, a squash and a lean; the body scales and leans about its feet.
  const mascotStyle = useAnimatedStyle(() => {
    const f = frames.value;
    const n = f.length / 4;
    if (n === 0) {
      return { opacity: mFade.value, transform: [{ translateX: toX.value }, { translateY: toY.value }] };
    }
    const i = Math.min(n - 1, Math.max(0, (clock.value - HOP0) / (1000 / 120)));
    const i0 = Math.floor(i);
    const i1 = Math.min(n - 1, i0 + 1);
    const u = i - i0;
    const at = (k: number) => f[i0 * 4 + k] + (f[i1 * 4 + k] - f[i0 * 4 + k]) * u;
    const x = at(0);
    const y = at(1);
    const sy = at(2);
    const th = (at(3) * Math.PI) / 180;
    const h = MASCOT_H / 2;
    return {
      opacity: mFade.value,
      transform: [
        { translateX: x - MASCOT_W / 2 + sy * h * Math.sin(th) },
        { translateY: y - h - sy * h * Math.cos(th) },
        { rotate: `${at(3).toFixed(3)}deg` },
        { scaleX: 1 / Math.sqrt(sy) },
        { scaleY: sy },
      ],
    };
  });

  const mascot = useRef<MascotHandle>(null);
  const nodeRefs = useRef<(WeekNodeHandle | null)[]>([]);
  const nodeViews = useRef<(View | null)[]>([]);
  const flagBurst = useRef<BurstHandle>(null);
  const flagS = useSharedValue(1);
  const flagStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flagS.value }],
  }));
  const dust = useRef<(BurstHandle | null)[]>([]);
  const run = useRef<{ from: number; to: number; finish: boolean; beats: Beat[]; next: number; skipped: boolean } | null>(null);

  const onBeat = (index: number) => {
    const r = run.current;
    const b = r?.beats[index];
    if (!r || !b || index < r.next) return; // each beat once (a skip may have run it already)
    r.next = index + 1;
    const fx = !r.skipped; // a skip lands the final state without the fanfare
    if (b.kind === 'check') {
      setRunStage(1);
      if (fx) nodeRefs.current[r.from - 1]?.pop();
    } else if (b.kind === 'leave') {
      setRunStage(2); // N-1's caption moves back beside its node, out from under the coach's way
    } else if (b.kind === 'dust') {
      if (fx) dust.current[b.i ?? 0]?.fire();
    } else if (b.kind === 'break') {
      if (fx && !r.finish) nodeRefs.current[r.to - 1]?.breakLock();
    } else if (b.kind === 'land') {
      setRunStage(3);
      if (fx) {
        dust.current[r.beats.filter((x) => x.kind === 'dust').length]?.fire();
        haptic.thud();
      }
    } else if (b.kind === 'turn') {
      if (fx) mascot.current?.turn();
    } else if (b.kind === 'open') {
      setRunStage(4);
      if (!fx) return;
      haptic.success();
      if (r.finish) {
        flagS.value = withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, spring.bouncy));
        flagBurst.current?.fire();
      } else nodeRefs.current[r.to - 1]?.pop();
    } else if (b.kind === 'done') {
      run.current = null;
      markPathSeen(); // before clearing the stage, so no frame shows the pre-unlock state
      setRunStage(null);
    }
  };
  const beatRef = useRef(onBeat);
  beatRef.current = onBeat;
  const beat = useCallback((i: number) => beatRef.current(i), []);

  useAnimatedReaction(
    () => {
      const t = clock.value;
      const ts = beatTimes.value;
      let n = 0;
      while (n < ts.length && ts[n] <= t) n++;
      return n;
    },
    (n, prev) => {
      if (prev === null || n <= prev) return;
      for (let i = prev; i < n; i++) scheduleOnRN(beat, i);
    },
  );

  /** Tap to skip: jump the clock to rest and land the remaining beats now, quietly. */
  const skip = useCallback(() => {
    const r = run.current;
    if (!r || r.skipped) return;
    r.skipped = true;
    cancelAnimation(clock);
    clock.value = REST;
    for (let i = r.next; i < r.beats.length; i++) beat(i);
  }, [clock, beat]);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  const startUnlock = useCallback(() => {
    if (run.current || !pending) return;
    const finish = currentWeek > total;
    const s = scrollY.value;
    const segTop = yOf(from) - NODE / 2;
    const segBottom = yOf(currentWeek) + NODE / 2 + 6;
    const inView = segTop - s > headerH && segBottom - s < visBottom;
    const fresh = Date.now() - mountedAt.current < 1200;

    if (reduce) {
      if (!inView) {
        scheduleOnUI(() => {
          'worklet';
          scrollTo(scrollRef, 0, segTarget, false);
        });
      }
      clock.value = REST;
      markPathSeen();
      nodeRefs.current[from - 1]?.pop();
      if (!finish) nodeRefs.current[currentWeek - 1]?.pop();
      mFade.value = 0;
      mFade.value = withTiming(1, { duration: FADE_MS });
      haptic.success();
      return;
    }

    run.current = { from, to: currentWeek, finish, beats, next: 0, skipped: false };
    setRunStage(0);
    let delay = fresh ? 850 : 250;
    if (!inView && !fresh) {
      const y = segTarget;
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, y, true);
      });
      delay += 450;
    }
    const end = beats[beats.length - 1]?.t ?? 0;
    clock.value = 0;
    clock.value = withDelay(delay, withTiming(end, { duration: end, easing: Easing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, currentWeek, total, from, reduce, headerH, visBottom, segTarget, trail, markPathSeen, beats]);

  // pending → hold the pre-unlock picture (before paint), then play when focused
  useLayoutEffect(() => {
    if (pending && !run.current) clock.value = 0;
  }, [pending, clock]);
  useEffect(() => {
    if (focused && pending) startUnlock();
  }, [focused, pending, startUnlock]);


  // the coach turns to face you when the current week scrolls into view
  const turn = () => mascot.current?.turn();
  const nodeY = trail.nodes[shownIdx].y;
  useAnimatedReaction(
    () => scrollY.value + winH * 0.85 > nodeY && scrollY.value + headerH < nodeY,
    (visible, prev) => {
      if (visible && prev === false) scheduleOnRN(turn);
    },
    [nodeY, winH, headerH],
  );

  // ---- Jump to current week ---------------------------------------------
  // -1: current node is above the viewport, 1: below, 0: visible. Computed on
  // the UI thread; React only hears about it when it changes.
  const [jumpDir, setJumpDir] = useState(0);
  const [pillDir, setPillDir] = useState(1);
  const curY = complete ? -1 : trail.nodes[Math.min(currentWeek, total) - 1].y;
  useAnimatedReaction(
    () => {
      if (curY < 0) return 0;
      const s = scrollY.value;
      if (curY + NODE / 2 + 6 - s < headerH + 8) return -1;
      if (curY - NODE / 2 - s > visBottom - 8) return 1;
      return 0;
    },
    (d, prev) => {
      if (d !== prev) scheduleOnRN(setJumpDir, d);
    },
    [curY, headerH, visBottom],
  );
  useEffect(() => {
    if (jumpDir !== 0) setPillDir(jumpDir);
  }, [jumpDir]);
  const pillOn = jumpDir !== 0 && !complete && runStage === null && !pending;
  const pill = useSharedValue(0);
  useEffect(() => {
    if (reduce) pill.value = withTiming(pillOn ? 1 : 0, { duration: FADE_MS });
    else pill.value = pillOn ? withSpring(1, spring.release) : withSpring(0, spring.snappy);
  }, [pillOn, reduce, pill]);
  const pillStyle = useAnimatedStyle(
    () => ({
      opacity: Math.min(1, pill.value),
      transform: reduce ? [] : [{ translateY: (1 - pill.value) * 18 * pillDir }, { scale: 0.85 + 0.15 * pill.value }],
    }),
    [reduce, pillDir],
  );

  const ack = () => nodeRefs.current[currentWeek - 1]?.pop();
  useAnimatedReaction(
    () => jumping.value >= 0 && Math.abs(scrollY.value - jumping.value) < 2,
    (arrived, prev) => {
      if (arrived && !prev) {
        jumping.value = -1;
        scheduleOnRN(ack);
      }
    },
  );
  const jumpToCurrent = () => {
    if (complete) return;
    const y = nodeTarget(currentWeek);
    if (reduce) {
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, y, false);
      });
      ack();
      return;
    }
    jumping.value = y;
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, y, true);
    });
  };

  // ---- week sheet --------------------------------------------------------
  const [sheet, setSheet] = useState<{
    unit: PathUnit;
    status: WeekStatus;
    i: number;
    origin?: { x: number; y: number };
    open: boolean;
  } | null>(null);
  const opening = useRef(false);
  const [hint, setHint] = useState<{ week: number; key: number } | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 2600);
    return () => clearTimeout(t);
  }, [hint]);

  const onNode = (unit: PathUnit, status: WeekStatus, i: number) => {
    if (runStage !== null || pending || opening.current || sheet?.open) return;
    if (status === 'locked') {
      haptic.warn();
      nodeRefs.current[i]?.shake();
      setHint({ week: unit.week, key: Date.now() });
      return;
    }
    const v = nodeViews.current[i];
    if (!v || reduce) {
      setSheet({ unit, status, i, open: true });
      return;
    }
    opening.current = true;
    v.measureInWindow((x, y, w) => {
      opening.current = false;
      setSheet({
        unit,
        status,
        i,
        origin: { x: x + w / 2, y: y + NODE / 2 },
        open: true,
      });
    });
  };
  const closeSheet = () => setSheet((s) => (s ? { ...s, open: false } : s));

  const headerRule = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], 'clamp'),
  }));

  const title = (
    <Text variant="subheading" accessibilityRole="header">
      {pathway.title}
      <Text variant="subheading" color={color.muted}>
        {shownComplete ? ' · Complete' : ` · Week ${shownWeek} of ${total}`}
      </Text>
    </Text>
  );

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        style={placedStyle}
        contentOffset={{ x: 0, y: openY }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={(e) => {
          touch.current = run.current ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() } : null;
        }}
        onTouchEnd={(e) => {
          const t0 = touch.current;
          touch.current = null;
          // a tap (not a drag) while the unlock plays skips to the end
          if (t0 && Math.hypot(e.nativeEvent.pageX - t0.x, e.nativeEvent.pageY - t0.y) < 10 && Date.now() - t0.t < 400) skip();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + layout.tabBarHeight,
        }}
      >
        {/* clipped like a phone screen: landmarks peek in from past the edge, and on a wide
            window (web, iPad) the column's edge is that edge, not the window's */}
        <View style={{ width, height: trail.height, overflow: 'hidden' }}>
          <SkyBackdrop light={light} width={width} />
          <Landscape
            bands={bands}
            width={width}
            height={trail.height}
            scrollY={scrollY}
            viewportH={winH}
            sky={<Celestial light={light} width={width} top={headerH} still={reduce || !focused} />}
          />
          <Landmarks items={landmarks} paused={reduce || !focused} />
          <Wash light={light} height={trail.height} />
          <Trail layout={trail} walked={walked} scrollY={scrollY} viewportH={winH} />

          {shownComplete && (
            <Enter style={[styles.done, { top: headerH + space[4] }]} from="scale">
              <Card tone="surface" padding={space[5]} contentStyle={styles.doneFace}>
                <Mascot pose="celebrate" mood="cheer" size={150} paused={!focused} accessibilityLabel="The antelope coach, celebrating" />
                <View style={styles.doneCopy}>
                  <Text variant="heading" align="center">
                    You’ve completed the {pathway.title} pathway.
                  </Text>
                  <Text variant="body" color={color.muted} align="center">
                    Keep practicing — everything is open.
                  </Text>
                </View>
                <Button label="Open practice" onPress={() => router.navigate('/practice')} fullWidth />
              </Card>
            </Enter>
          )}

          {/* captions, nodes, then the coach in front (it bounds past the nodes; captions are cleared out of its way) */}
          {pathway.units.map((u, i) => {
            const p = trail.nodes[i];
            const status = statusOf(u.week);
            const labelLeft = p.x > width / 2;
            const isCurrent = status === 'current';
            const gap = captionGap(p, width, isCurrent);
            const room = captionRoom(p, width, gap);
            const coachHere = coachCaptionWeek === u.week;
            const below = coachHere && spotNow.sideRight === !labelLeft;
            const top = below ? p.y + NODE / 2 + 14 : p.y - 26;
            // up by the sky, a caption gets a white backing: the night sky is navy under dark text
            const sky = onSky(top);
            return (
              <Fragment key={u.id}>
                {/* a label that moves (the coach arrives or leaves) or changes shape cross-fades */}
                <LabelFade
                  token={`${status}-${below}`}
                  style={[
                    styles.label,
                    { top, maxWidth: room },
                    labelLeft
                      ? {
                          right: width - (p.x - NODE / 2 - gap),
                          alignItems: 'flex-end',
                        }
                      : { left: p.x + NODE / 2 + gap },
                    sky ? styles.skyLabel : null,
                  ]}
                >
                  <Text
                    variant="overline"
                    color={status === 'complete' ? light.text.complete : status === 'current' ? light.text.current : light.text.muted}
                  >
                    Week {u.week}
                  </Text>
                  <Text
                    variant="subheading"
                    color={status === 'locked' ? light.text.muted : light.text.ink}
                    align={labelLeft ? 'right' : 'left'}
                    numberOfLines={2}
                    style={u.title.length > 16 ? styles.long : null}
                  >
                    {u.title}
                  </Text>
                  {isCurrent ? (
                    <Text variant="caption" color={light.text.muted} align={labelLeft ? 'right' : 'left'} style={styles.sub}>
                      {u.subtitle}
                    </Text>
                  ) : null}
                </LabelFade>
              </Fragment>
            );
          })}

          {pathway.units.map((u, i) => {
            const p = trail.nodes[i];
            const status = statusOf(u.week);
            return (
              <Fragment key={u.id}>
                <View
                  ref={(r) => {
                    nodeViews.current[i] = r;
                  }}
                  collapsable={false}
                  style={[styles.node, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]}
                >
                  <WeekNode
                    ref={(r) => {
                      nodeRefs.current[i] = r;
                    }}
                    week={u.week}
                    total={total}
                    title={u.title}
                    status={status}
                    paused={!focused}
                    anchored={!!sheet?.open && sheet.i === i}
                    onPress={() => onNode(u, status, i)}
                  />
                </View>
              </Fragment>
            );
          })}

          {/* dust where each hop lands, drawn under the coach */}
          {bound && (pending || runStage !== null)
            ? bound.spots.map((p, k) => (
                <View key={k} pointerEvents="none" style={[styles.dust, { left: p.x, top: p.y }]}>
                  <Burst
                    ref={(r) => {
                      dust.current[k] = r;
                    }}
                    particles="dust"
                    count={10}
                    power={0.26}
                    scale={1.15}
                    spread={82}
                    duration={520}
                    colors={DUST}
                  />
                </View>
              ))
            : null}

          <Animated.View pointerEvents="none" style={[styles.mascot, mascotStyle]}>
            <Mascot
              ref={mascot}
              pose="wave"
              size={MASCOT_H}
              flip={spotNow.flip}
              paused={!focused}
              accessibilityLabel={
                mascotWeek > total ? 'The antelope coach, at the finish line' : 'The antelope coach, waiting at this week'
              }
            />
          </Animated.View>

          {pathway.units.map((u, i) => {
            const p = trail.nodes[i];
            return (
              <Fragment key={u.id}>
                {hint?.week === u.week && (
                  <Enter
                    key={hint.key}
                    from="scale"
                    style={[
                      styles.hint,
                      {
                        top: p.y - NODE / 2 - 58,
                        left: Math.min(Math.max(12, p.x - 110), width - 232),
                      },
                    ]}
                  >
                    <Text variant="label" color={color.white} align="center">
                      Finish week {u.week - 1} to open {u.title}.
                    </Text>
                  </Enter>
                )}
              </Fragment>
            );
          })}

          <View
            style={[
              styles.finish,
              {
                left: trail.finish.x - FLAG / 2,
                top: trail.finish.y - FLAG / 2,
              },
            ]}
          >
            <Animated.View style={[styles.flag, shownComplete && styles.flagDone, flagStyle]}>
              <FlagPennantIcon size={28} weight="fill" color={shownComplete ? color.white : color.faint} />
              <Burst ref={flagBurst} count={22} power={0.8} spread={110} />
            </Animated.View>
            <Text variant="caption" color={light.text.muted} align="center" style={styles.finishText}>
              {shownComplete ? 'Pathway complete' : 'Finish line'}
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={pillOn ? 'box-none' : 'none'}
        style={[
          styles.pillDock,
          pillDir < 0 ? { top: headerH + space[3] } : { bottom: insets.bottom + layout.tabBarHeight + space[4] },
          pillStyle,
        ]}
      >
        <PressableSurface
          tone="primary"
          depth={4}
          radius={22}
          onPress={jumpToCurrent}
          accessibilityLabel={`Jump to week ${currentWeek}`}
          contentStyle={styles.pillFace}
        >
          {pillDir < 0 ? (
            <CaretUpIcon size={16} weight="bold" color={color.white} />
          ) : (
            <CaretDownIcon size={16} weight="bold" color={color.white} />
          )}
          <Text variant="label" color={color.white}>
            Week {Math.min(currentWeek, total)}
          </Text>
        </PressableSurface>
      </Animated.View>

      <View style={[styles.header, { paddingTop: insets.top + space[3], height: headerH }]}>
        <View style={styles.headerInner}>
          {title}
          <View
            style={styles.bar}
            accessible
            accessibilityLabel={`${pathway.title}: ${Math.min(shownWeek - 1, total)} of ${total} weeks complete`}
          >
            {pathway.units.map((u) => {
              const s = statusOf(u.week);
              return <View key={u.id} style={[styles.seg, s === 'complete' && styles.segDone, s === 'current' && styles.segNow]} />;
            })}
          </View>
        </View>
        <Animated.View style={[styles.rule, headerRule]} />
      </View>

      <UnitSheet
        unit={sheet?.unit ?? null}
        open={!!sheet?.open}
        origin={sheet?.origin}
        status={sheet?.status ?? 'current'}
        weeks={total}
        completed={completed}
        onClose={closeSheet}
        onStart={(activityId) => {
          const a = sheet?.unit.activities.find((x) => x.id === activityId);
          closeSheet();
          if (a) setTimeout(() => openActivity(a, 'path'), 180);
        }}
      />
    </View>
  );
}

/**
 * A node label. When it moves (the coach arrives or leaves) or changes shape
 * (the subtitle shows for the current week) it fades in at its new place
 * instead of jumping. Not on first mount. Same under reduced motion: a fade.
 */
function LabelFade({ token, style, children }: { token: string; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const o = useSharedValue(1);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    o.value = 0;
    o.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [token, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" style={[style, a]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: color.white,
    paddingHorizontal: layout.gutter,
  },
  headerInner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: space[3],
  },
  bar: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line },
  segDone: { backgroundColor: color.gold },
  segNow: { backgroundColor: color.primary },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: color.line,
  },
  node: { position: 'absolute', width: NODE, height: NODE + 6 },
  label: { position: 'absolute' },
  skyLabel: {
    backgroundColor: color.white,
    borderRadius: radius.badge,
    paddingHorizontal: SKY_LABEL_PAD.x,
    paddingVertical: SKY_LABEL_PAD.y,
  },
  sub: { marginTop: 2 },
  long: { fontSize: 16, lineHeight: 20 },
  mascot: { position: 'absolute', left: 0, top: 0, width: MASCOT_W, height: MASCOT_H },
  dust: { position: 'absolute', width: 0, height: 0 },
  hint: {
    position: 'absolute',
    width: 220,
    backgroundColor: color.navy,
    borderRadius: 14,
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
  },
  finish: { position: 'absolute', width: FLAG, alignItems: 'center' },
  flag: {
    width: FLAG,
    height: FLAG,
    borderRadius: FLAG / 2,
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  finishText: { width: 120, marginTop: space[2] },
  done: { position: 'absolute', left: layout.gutter, right: layout.gutter },
  doneFace: { alignItems: 'center', gap: space[4] },
  doneCopy: { gap: space[1] },
  pillDock: { position: 'absolute', alignSelf: 'center' },
  pillFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
});
