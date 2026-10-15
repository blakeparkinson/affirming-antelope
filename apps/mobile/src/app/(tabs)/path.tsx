import type { Pathway, PathUnit } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
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
import { captionBox, layoutBands, layoutLandmarks, layoutTrail, NODE, type TrailLayout } from '@/components/path/geometry';
import { LANDMARK_ART, landmarkPlan, Landmarks } from '@/components/path/Landmarks';
import { Landscape, motifFor, PALETTES } from '@/components/path/Landscape';
import { Trail } from '@/components/path/Trail';
import { UnitSheet } from '@/components/path/UnitSheet';
import { WeekNode, type WeekNodeHandle } from '@/components/path/WeekNode';
import { Button, Card, CaretDownIcon, CaretUpIcon, FlagPennantIcon, PressableSurface, Text, color, haptic, layout, space } from '@/design';
import { openActivity } from '@/data/routes';
import { Burst, Enter, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { totalWeeks, useActivePathway, useProgress } from '@/state/selectors';
import { useLearner, weekStatus, type WeekStatus } from '@/state/store';

const HEADER = 76;
const MASCOT_H = 104;
const MASCOT_W = MASCOT_H * (674 / 978);
const FLAG = 60;

/*
 * Path unlock choreography. Plays once when the screen is focused and
 * `currentWeek > pathSeenWeek` (N-1 → N), then marks the week seen.
 * One UI-thread clock drives the line and the mascot; beats cross into React
 * (status swaps, imperative pops, haptic) only when the clock passes them.
 *
 *  lead-in   focus settles (250ms; 850ms on a fresh mount so the trail's own
 *            draw-in finishes); if the N-1→N segment is out of view, a native
 *            animated scroll centres it first (+450ms)
 *  t=0       ochre starts drawing from N-1's rim                (600ms, ease in-out)
 *  t=30      N-1 lands its check: dip, cobalt → ochre, bouncy overshoot
 *  t=580     the line touches N: shackle lifts and swings open on one leg,
 *            the body drops away, small cobalt-led burst
 *  t=700     N pops locked → current (cobalt, bouncy), haptic.success on the
 *            same frame, breathing ring starts. Pathway finished instead: the
 *            finish flag pops gold with an ochre burst.
 *  t=800     the coach hops N-1 → N: up and away, then drops in beside N (540ms; never crosses a label)
 *  t=1340    lands and hops
 *  t=1600    done: markPathSeen
 *
 * Interruptible: node taps are ignored while it runs, a replay can't start on
 * top of itself, the user can grab the scroll at any time. Reduced motion:
 * final state at once, nodes and coach cross-fade, one success haptic.
 * Dev: Me > Demo > Replay path unlock.
 */
const DRAW_MS = 600;
const B_CHECK = 30;
const B_BREAK = 580;
const B_OPEN = 700;
const GLIDE0 = 800;
const GLIDE_MS = 540;
const B_LAND = GLIDE0 + GLIDE_MS;
const B_DONE = 1600;
const STAGE_FINAL = 6;
const RIM = NODE / 2 - 6;

interface Spot {
  left: number;
  top: number;
  flip: boolean;
  sideRight: boolean;
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
        return captionBox(p, width, { title: u.title, subtitle: currentWeek === u.week ? u.subtitle : undefined }, below);
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
    if (stage >= 3) return weekStatus(week, currentWeek);
    if (week === from) return stage >= 1 ? 'complete' : 'current';
    return weekStatus(week, from);
  };
  const shownComplete = complete && stage >= 3;
  const shownWeek = stage >= 3 ? currentWeek : from;
  const mascotWeek = stage >= 4 ? currentWeek : from;
  const shownIdx = Math.min(shownWeek, total) - 1;

  const yOf = (week: number) => (week > total ? trail.finish.y : trail.nodes[week - 1].y);
  const segTarget = clampY((yOf(Math.max(1, from)) + yOf(currentWeek)) / 2 - (headerH + visBottom) / 2);
  const nodeTarget = (week: number) => clampY(yOf(week) - (headerH + visBottom) / 2 + 20);

  // ---- scroll ------------------------------------------------------------
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const jumping = useSharedValue(-1); // scroll target of a Jump tap, -1 when idle
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onBeginDrag: () => {
      jumping.value = -1;
    },
  });

  // open on the current week (or on the segment that's about to unlock)
  const mountedAt = useRef(Date.now());
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || (complete && !pending)) return;
    didScroll.current = true;
    const y = pending ? segTarget : nodeTarget(currentWeek);
    const t = setTimeout(() => {
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, y, false);
      });
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, pending, segTarget, scrollRef]);

  // ---- the clock ---------------------------------------------------------
  // -1 idle before a run, 0 = draw starts, B_DONE = at rest (final state).
  const clock = useSharedValue(pending ? 0 : B_DONE);
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

  const walked = useDerivedValue(() => {
    const t = clock.value;
    if (t <= 0) return lenA.value;
    if (t >= DRAW_MS) return lenD.value;
    const x = t / DRAW_MS;
    const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    return lenB.value + (lenC.value - lenB.value) * e;
  });

  // coach position: always transform-driven so a glide never waits on a re-render
  const spotFrom = mascotSpot(trail, width, Math.max(1, from));
  const spotTo = mascotSpot(trail, width, currentWeek);
  const spotNow = mascotSpot(trail, width, Math.max(1, mascotWeek));
  const mFromX = useSharedValue(spotFrom.left);
  const mFromY = useSharedValue(spotFrom.top);
  const mToX = useSharedValue(spotTo.left);
  const mToY = useSharedValue(spotTo.top);
  const mFade = useSharedValue(1);
  useLayoutEffect(() => {
    mFromX.value = from >= 1 ? spotFrom.left : spotTo.left;
    mFromY.value = from >= 1 ? spotFrom.top : spotTo.top;
    mToX.value = spotTo.left;
    mToY.value = spotTo.top;
  }, [from, spotFrom.left, spotFrom.top, spotTo.left, spotTo.top, mFromX, mFromY, mToX, mToY]);
  // the coach hops between nodes rather than gliding across the trail, so it never passes over a label:
  // first half, it springs up and away from week N-1 (rise 22pt, shrink, fade); second half, it drops in
  // beside week N from 26pt above and lands (then hop() on landing)
  const mascotStyle = useAnimatedStyle(() => {
    const g = Math.min(1, Math.max(0, (clock.value - GLIDE0) / GLIDE_MS));
    if (g < 0.5) {
      const u = g / 0.5;
      const lift = Math.sin((Math.PI / 2) * u);
      return {
        opacity: mFade.value * (1 - u),
        transform: [{ translateX: mFromX.value }, { translateY: mFromY.value - 22 * lift }, { scale: 1 - 0.18 * u }],
      };
    }
    const u = (g - 0.5) / 0.5;
    const fall = u * u;
    return {
      opacity: mFade.value * Math.min(1, u * 2.2),
      transform: [{ translateX: mToX.value }, { translateY: mToY.value - 26 * (1 - fall) }, { scale: 0.86 + 0.14 * u }],
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
  const run = useRef<{ from: number; to: number; finish: boolean } | null>(null);

  const onBeat = (b: number) => {
    const r = run.current;
    if (!r) return;
    if (b === 1) {
      setRunStage(1);
      nodeRefs.current[r.from - 1]?.pop();
    } else if (b === 2) {
      if (!r.finish) nodeRefs.current[r.to - 1]?.breakLock();
    } else if (b === 3) {
      setRunStage(3);
      haptic.success();
      if (r.finish) {
        flagS.value = withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, spring.bouncy));
        flagBurst.current?.fire();
      } else nodeRefs.current[r.to - 1]?.pop();
    } else if (b === 4) {
      setRunStage(4);
    } else if (b === 5) {
      mascot.current?.hop();
    } else if (b === 6) {
      run.current = null;
      markPathSeen(); // before clearing the stage, so no frame shows the pre-unlock state
      setRunStage(null);
    }
  };
  const beatRef = useRef(onBeat);
  beatRef.current = onBeat;
  const beat = useCallback((b: number) => beatRef.current(b), []);

  useAnimatedReaction(
    () => {
      const t = clock.value;
      return t >= B_DONE ? 6 : t >= B_LAND ? 5 : t >= GLIDE0 ? 4 : t >= B_OPEN ? 3 : t >= B_BREAK ? 2 : t >= B_CHECK ? 1 : 0;
    },
    (b, prev) => {
      if (prev === null || b <= prev) return;
      for (let i = prev + 1; i <= b; i++) scheduleOnRN(beat, i);
    },
  );

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
      clock.value = B_DONE;
      markPathSeen();
      nodeRefs.current[from - 1]?.pop();
      if (!finish) nodeRefs.current[currentWeek - 1]?.pop();
      mFade.value = 0;
      mFade.value = withTiming(1, { duration: FADE_MS });
      haptic.success();
      return;
    }

    run.current = { from, to: currentWeek, finish };
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
    clock.value = 0;
    clock.value = withDelay(delay, withTiming(B_DONE, { duration: B_DONE, easing: Easing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, currentWeek, total, from, reduce, headerH, visBottom, segTarget, trail, markPathSeen]);

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
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + layout.tabBarHeight,
        }}
      >
        <View style={{ width, height: trail.height }}>
          <Landscape bands={bands} width={width} height={trail.height} scrollY={scrollY} viewportH={winH} />
          <Landmarks items={landmarks} paused={reduce || !focused} />
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
            const status = statusOf(u.week);
            const labelLeft = p.x > width / 2;
            const room = labelLeft ? p.x - NODE / 2 - 26 : width - p.x - NODE / 2 - 26;
            const isCurrent = status === 'current';
            const coachHere = mascotWeek === u.week;
            const below = coachHere && spotNow.sideRight === !labelLeft;
            return (
              <View key={u.id}>
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
                {/* a label that moves (the coach arrives or leaves) or changes shape cross-fades */}
                <LabelFade
                  token={`${status}-${below}`}
                  style={[
                    styles.label,
                    { top: p.y - 26, maxWidth: Math.max(110, room) },
                    labelLeft
                      ? {
                          right: width - (p.x - NODE / 2 - 14),
                          alignItems: 'flex-end',
                        }
                      : { left: p.x + NODE / 2 + 14 },
                    below ? { top: p.y + NODE / 2 + 14 } : null,
                  ]}
                >
                  <Text
                    variant="overline"
                    color={status === 'complete' ? color.goldInk : status === 'current' ? color.primaryShadow : color.muted}
                  >
                    Week {u.week}
                  </Text>
                  <Text
                    variant="subheading"
                    color={status === 'locked' ? color.muted : color.ink}
                    align={labelLeft ? 'right' : 'left'}
                    numberOfLines={2}
                    style={u.title.length > 16 ? styles.long : null}
                  >
                    {u.title}
                  </Text>
                  {isCurrent ? (
                    <Text variant="caption" color={color.muted} align={labelLeft ? 'right' : 'left'} style={styles.sub}>
                      {u.subtitle}
                    </Text>
                  ) : null}
                </LabelFade>
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
              </View>
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
            <Text variant="caption" color={color.muted} align="center" style={styles.finishText}>
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
  sub: { marginTop: 2 },
  long: { fontSize: 16, lineHeight: 20 },
  mascot: { position: 'absolute', left: 0, top: 0 },
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
