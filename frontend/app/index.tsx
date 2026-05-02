import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { Asset } from "expo-asset";
import { useFonts, Bungee_400Regular } from "@expo-google-fonts/bungee";
import * as SplashScreen from "expo-splash-screen";

import { PHOTOS, PHOTO_COUNT } from "../src/photos";

SplashScreen.preventAutoHideAsync().catch(() => {});

// ===== THEME =====
const COLORS = {
  black: "#000000",
  green: "#1f4d36", // dark casino green
  greenDeep: "#173b29",
  bronze: "#c79a4a",
  bronzeLight: "#e9c87a",
  bronzeDark: "#7a5a25",
  red: "#a02838",
  redLight: "#d34754",
  redDark: "#5e1620",
  bulbYellow: "#f5c842",
  bulbRed: "#a02838",
  bulbOff: "#3a2614",
  textBronze: "#e9c87a",
};

const _dim = Dimensions.get("window");
const SW = _dim.width || 412;
const SH = _dim.height || 915;
const MACHINE_W = Math.min(SW * 0.94, 460);
// Reduce machine height by 10% (keep width unchanged).
const MACHINE_H = Math.min(SH * 0.92, 820) * 0.9;

// Photo viewer (square ratio 1:1, reduced 10%)
const PHOTO_W = MACHINE_W * 0.7;
const PHOTO_H = PHOTO_W;

// Slider
const SLIDER_TRACK_W = MACHINE_W * 0.78;
const SLIDER_TRACK_H = 56;
const BALL = 44;
const SLIDER_MAX = SLIDER_TRACK_W - BALL - 6;

// Bulbs
const BULB_SIZE = 12;
const BULBS_PER_ROW = Math.floor((MACHINE_W - 24) / 22);
const BULBS_PER_COL = Math.floor((MACHINE_H - 24) / 28);

// Animation constants
const STRIP_ITEMS = 28; // photos in scroll strip
const SPIN_DURATION = 2000;
const DING_DURATION = 2030;

// ===== Helpers =====
const cryptoRandomInt = (max: number) => {
  const bytes = Crypto.getRandomBytes(4);
  const n =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return Math.abs(n) % max;
};

// Closed-form inverse of Easing.out(Easing.cubic).
// Easing.out(cubic): y = 1 - (1 - t)^3  →  t = 1 - (1 - y)^(1/3)
// Use this to pre-compute the exact instant at which each photo arrives
// in the viewport, so each tick can be scheduled with setTimeout
// perfectly in sync with the UI-thread animation.
const easeOutCubicInverse = (y: number) => 1 - Math.pow(1 - y, 1 / 3);

// ===== Bulbs =====
const Bulb = ({
  index,
  color,
  on,
}: {
  index: number;
  color: string;
  on: boolean;
}) => (
  <View
    style={[
      styles.bulb,
      {
        backgroundColor: on ? color : COLORS.bulbOff,
        shadowColor: color,
        shadowOpacity: on ? 0.95 : 0,
        borderColor: on ? "#fff7d6" : "#1a1208",
      },
    ]}
    testID={`bulb-${index}`}
  />
);

const BulbRow = ({
  count,
  tick,
  offset = 0,
}: {
  count: number;
  tick: number;
  offset?: number;
}) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const isYellow = (i + offset) % 2 === 0;
    const phase = (i + offset + tick) % 2 === 0;
    items.push(
      <Bulb
        key={i}
        index={i + offset}
        color={isYellow ? COLORS.bulbYellow : COLORS.bulbRed}
        on={phase}
      />
    );
  }
  return <View style={styles.bulbRow}>{items}</View>;
};

const BulbCol = ({
  count,
  tick,
  offset = 0,
}: {
  count: number;
  tick: number;
  offset?: number;
}) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const isYellow = (i + offset) % 2 === 0;
    const phase = (i + offset + tick) % 2 === 0;
    items.push(
      <Bulb
        key={i}
        index={i + offset}
        color={isYellow ? COLORS.bulbYellow : COLORS.bulbRed}
        on={phase}
      />
    );
  }
  return <View style={styles.bulbCol}>{items}</View>;
};

// ===== Bronze bandeau (3D-look horizontal bar above/below photo) =====
const BronzeBand = React.memo(() => (
  <View style={styles.bandWrap}>
    <View style={styles.bandTop} />
    <View style={styles.bandMid} />
    <View style={styles.bandBot} />
  </View>
));
BronzeBand.displayName = "BronzeBand";

// ===== Photo Strip (the scrolling reel) =====
type PhotoStripProps = {
  translateY: SharedValue<number>;
  stripIndices: number[];
};

const PhotoStrip = React.memo(({ translateY, stripIndices }: PhotoStripProps) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.strip, animatedStyle]}>
      {stripIndices.map((idx, i) => (
        <View key={`${i}-${idx}`} style={styles.stripItem}>
          <Image
            source={PHOTOS[idx]}
            style={styles.stripImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      ))}
    </Animated.View>
  );
});

// ===== Slider Lever =====
type SliderProps = {
  onTrigger: () => void;
  resetSignal: number;
  disabled: boolean;
};

const SliderLever = ({ onTrigger, resetSignal, disabled }: SliderProps) => {
  const x = useSharedValue(0);
  const startX = useSharedValue(0);

  useEffect(() => {
    x.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [resetSignal, x]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      startX.value = x.value;
    })
    .onUpdate((e) => {
      const next = Math.min(SLIDER_MAX, Math.max(0, startX.value + e.translationX));
      x.value = next;
    })
    .onEnd(() => {
      if (x.value >= SLIDER_MAX * 0.85) {
        x.value = withTiming(SLIDER_MAX, { duration: 80 }, () => {
          runOnJS(onTrigger)();
        });
      } else {
        x.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + BALL / 2,
  }));

  return (
    <View style={styles.sliderWrap} testID="slider-wrap">
      <View style={styles.sliderTrack}>
        <Animated.View style={[styles.sliderFill, fillStyle]} />
        <Text style={styles.sliderHint}>SLIDE TO SPIN ▶</Text>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.ballOuter, ballStyle]} testID="slider-ball">
            <View style={styles.ballInner}>
              <View style={styles.ballHighlight} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
};

// ===== Main Screen =====
export default function Index() {
  const [fontsLoaded] = useFonts({ Bungee_400Regular });
  const [assetsReady, setAssetsReady] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number>(() => cryptoRandomInt(PHOTO_COUNT));
  const [stripIndices, setStripIndices] = useState<number[]>(() => {
    const arr: number[] = [];
    for (let i = 0; i < STRIP_ITEMS; i++) arr.push(cryptoRandomInt(PHOTO_COUNT));
    return arr;
  });
  const [spinning, setSpinning] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [bulbTick, setBulbTick] = useState(0);
  const [titleBlink, setTitleBlink] = useState(true);

  const lastIdxRef = useRef<number>(currentIdx);
  const tickSoundsRef = useRef<Audio.Sound[]>([]);
  const tickIdxRef = useRef(0);
  const dingSoundRef = useRef<Audio.Sound | null>(null);
  const tickTimersRef = useRef<NodeJS.Timeout[]>([]);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);

  const translateY = useSharedValue(0);

  // Pre-load assets + sounds (non-blocking, robust on web/native)
  useEffect(() => {
    let cancelled = false;
    let timedOut = false;

    // Hard fallback: never block UI more than 1.5s
    const fallbackTimer = setTimeout(() => {
      console.log("[EgoParty] Fallback timer fired");
      if (cancelled) return;
      timedOut = true;
      setAssetsReady(true);
    }, 1500);

    console.log("[EgoParty] Mount: scheduled fallback timer");

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
      } catch {}

      // Pre-load sounds in parallel (best effort).
      // Pool size = STRIP_ITEMS so each scheduled tick uses a fresh instance
      // (avoids replay collisions that make ticks "feel random").
      try {
        const tickPromises: Promise<Audio.Sound | null>[] = [];
        for (let i = 0; i < STRIP_ITEMS; i++) {
          tickPromises.push(
            Audio.Sound.createAsync(
              require("../assets/sounds/tick.wav"),
              { volume: 0.55 }
            )
              .then((r) => r.sound)
              .catch(() => null)
          );
        }
        const dingPromise = Audio.Sound.createAsync(
          require("../assets/sounds/ding.mp3"),
          { volume: 1.0 }
        )
          .then((r) => r.sound)
          .catch(() => null);

        const [ticks, ding] = await Promise.all([
          Promise.all(tickPromises),
          dingPromise,
        ]);
        if (cancelled) return;
        tickSoundsRef.current = ticks.filter(
          (s): s is Audio.Sound => s !== null
        );
        dingSoundRef.current = ding;
      } catch {}

      if (!cancelled && !timedOut) {
        clearTimeout(fallbackTimer);
        setAssetsReady(true);
      }

      // Background pre-warm
      try {
        await Asset.loadAsync(PHOTOS);
      } catch {}
    })();
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Hide splash when ready
  useEffect(() => {
    if (assetsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [assetsReady]);

  // Bulb animation tick (no impact on UI thread spin)
  useEffect(() => {
    const t = setInterval(() => setBulbTick((v) => (v + 1) % 1000), 480);
    return () => clearInterval(t);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      tickTimersRef.current.forEach((t) => clearTimeout(t));
      if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);
      tickSoundsRef.current.forEach((s) => {
        s.unloadAsync().catch(() => {});
      });
      dingSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playTick = useCallback(() => {
    const pool = tickSoundsRef.current;
    if (!pool.length) return;
    const s = pool[tickIdxRef.current % pool.length];
    tickIdxRef.current++;
    s.replayAsync().catch(() => {});
  }, []);

  const playDing = useCallback(() => {
    const s = dingSoundRef.current;
    if (!s) return;
    s.replayAsync().catch(() => {});
  }, []);

  // Per-photo tick: pre-compute the exact instant each photo will arrive
  // in the viewport by inverting the same easing curve as the animation
  // (Easing.out(cubic)). One setTimeout per photo → 1 click = 1 photo,
  // perfectly in sync regardless of deceleration.
  // AUDIO_LATENCY: on iOS, playAsync/replayAsync has ~30-50 ms of latency
  // before the sound is audibly produced. We schedule the timeouts that
  // amount earlier so the click is HEARD when the photo APPEARS.
  const AUDIO_LATENCY = 35;
  const scheduleTicks = useCallback(() => {
    tickTimersRef.current.forEach((t) => clearTimeout(t));
    tickTimersRef.current = [];
    tickIdxRef.current = 0; // fresh pool for this spin
    const photosToCross = STRIP_ITEMS - 1;
    for (let k = 1; k <= photosToCross; k++) {
      const y = k / photosToCross;                    // visual progress [0..1]
      const t = easeOutCubicInverse(y);               // normalized time [0..1]
      const ms = Math.max(
        0,
        Math.round(t * SPIN_DURATION * ACTIVE_RATIO) - AUDIO_LATENCY
      );
      const id = setTimeout(playTick, ms);
      tickTimersRef.current.push(id);
    }
  }, [playTick]);

  const triggerSpin = useCallback(() => {
    if (spinning || !assetsReady) return;
    setSpinning(true);

    // Pick winner (no immediate repeat)
    let winner = cryptoRandomInt(PHOTO_COUNT);
    if (PHOTO_COUNT > 1) {
      while (winner === lastIdxRef.current) {
        winner = cryptoRandomInt(PHOTO_COUNT);
      }
    }

    // Build strip: random photos with winner at the end
    const newStrip: number[] = [];
    newStrip.push(lastIdxRef.current);
    for (let i = 1; i < STRIP_ITEMS - 1; i++) {
      let r = cryptoRandomInt(PHOTO_COUNT);
      if (r === newStrip[i - 1]) r = (r + 1) % PHOTO_COUNT;
      newStrip.push(r);
    }
    newStrip.push(winner);
    setStripIndices(newStrip);

    // Reset
    translateY.value = 0;

    // Haptic at start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Animate translateY from 0 to -(STRIP_ITEMS-1)*PHOTO_H with deceleration.
    // Schedule ticks at the SAME JS-frame as withTiming() so the timer
    // baseline matches the animation start as closely as possible.
    const target = -(STRIP_ITEMS - 1) * PHOTO_H;
    requestAnimationFrame(() => {
      translateY.value = withTiming(
        target,
        {
          duration: SPIN_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleSpinEnd)(winner);
          }
        }
      );
      scheduleTicks();
    });
  }, [assetsReady, scheduleTicks, spinning, translateY]);

  const handleSpinEnd = useCallback(
    (winner: number) => {
      lastIdxRef.current = winner;
      setCurrentIdx(winner);
      playDing();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );

      // Reset slider IMMEDIATELY at the photo reveal (not at end of blink).
      setResetSignal((v) => v + 1);

      // Title blink (red ↔ bronze) synced with ding (~2030 ms)
      const blinkInterval = 180; // 11 toggles ~ 2030ms
      let toggles = 0;
      const totalToggles = Math.floor(DING_DURATION / blinkInterval);
      if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = setInterval(() => {
        setTitleBlink((v) => !v);
        toggles++;
        if (toggles >= totalToggles) {
          if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);
          setTitleBlink(true);
          setSpinning(false);
        }
      }, blinkInterval);
    },
    [playDing]
  );

  // Animated title style — blinks RED ↔ bronze during reveal, returns to bronze after.
  const titleStyle = useMemo(
    () => [
      styles.title,
      fontsLoaded && { fontFamily: "Bungee_400Regular" },
      { color: titleBlink ? COLORS.bronzeLight : COLORS.red },
    ],
    [titleBlink, fontsLoaded]
  );

  // Always render the slot machine; photos load lazily via expo-image.
  // (No blocking loader to avoid web SSR + slow hydration locking the UI.)

  return (
    <SafeAreaView style={styles.root} testID="ego-party-screen">
      <View style={styles.machineWrap}>
        {/* Outer bronze double frame with bulbs */}
        <View style={styles.machineOuter}>
          {/* Top bulbs row */}
          <View style={styles.bulbBandTop}>
            <BulbRow count={BULBS_PER_ROW} tick={bulbTick} />
          </View>

          {/* Bottom bulbs row */}
          <View style={styles.bulbBandBottom}>
            <BulbRow count={BULBS_PER_ROW} tick={bulbTick} offset={1} />
          </View>

          {/* Left bulbs col */}
          <View style={styles.bulbBandLeft}>
            <BulbCol count={BULBS_PER_COL} tick={bulbTick} offset={2} />
          </View>

          {/* Right bulbs col */}
          <View style={styles.bulbBandRight}>
            <BulbCol count={BULBS_PER_COL} tick={bulbTick} offset={3} />
          </View>

          {/* Inner double-bronze frame */}
          <View style={styles.bronzeOuter}>
            <View style={styles.bronzeGap} />
            <View style={styles.bronzeInner}>
              {/* Green machine body */}
              <View style={styles.body}>
                {/* Title — vertically centered between top of body and top bronze band */}
                <View style={styles.titleSection}>
                  <Text style={titleStyle} testID="title-ego-party">
                    EGO PARTY
                  </Text>
                  <Text
                    style={[
                      styles.subtitle,
                      fontsLoaded && { fontFamily: "Bungee_400Regular" },
                    ]}
                    testID="subtitle-slot-machine"
                  >
                    SLOT MACHINE
                  </Text>
                </View>

                {/* Bronze bandeau top */}
                <BronzeBand />

                {/* Photo viewer */}
                <View style={styles.photoFrame} testID="photo-frame">
                  <View style={styles.photoFrameInner}>
                    <View style={styles.photoMask}>
                      {spinning ? (
                        <PhotoStrip
                          translateY={translateY}
                          stripIndices={stripIndices}
                        />
                      ) : (
                        <Image
                          source={PHOTOS[currentIdx]}
                          style={styles.stripImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          testID="winner-photo"
                        />
                      )}
                    </View>
                  </View>
                </View>

                {/* Bronze bandeau bottom */}
                <BronzeBand />

                {/* Slider + hint, centered vertically in the lower flex space */}
                <View style={styles.sliderSection}>
                  <SliderLever
                    onTrigger={triggerSpin}
                    resetSignal={resetSignal}
                    disabled={spinning}
                  />

                  <Text style={styles.footerHint} testID="footer-hint">
                    {spinning ? "🎰 SPINNING…" : "Slide the red knob right →"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ===== Styles =====
const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  loadingText: {
    color: COLORS.bronzeLight,
    fontSize: 32,
    letterSpacing: 4,
    fontWeight: "900",
  },
  loadingSub: {
    color: COLORS.bronze,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 8,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  machineWrap: {
    width: MACHINE_W,
    height: MACHINE_H,
    alignItems: "center",
    justifyContent: "center",
  },
  machineOuter: {
    width: MACHINE_W,
    height: MACHINE_H,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  // Bulb bands (positioned absolutely around the frame)
  bulbBandTop: {
    position: "absolute",
    top: 4,
    left: 12,
    right: 12,
    height: BULB_SIZE + 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 5,
  },
  bulbBandBottom: {
    position: "absolute",
    bottom: 4,
    left: 12,
    right: 12,
    height: BULB_SIZE + 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 5,
  },
  bulbBandLeft: {
    position: "absolute",
    left: 4,
    top: 24,
    bottom: 24,
    width: BULB_SIZE + 6,
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 5,
  },
  bulbBandRight: {
    position: "absolute",
    right: 4,
    top: 24,
    bottom: 24,
    width: BULB_SIZE + 6,
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 5,
  },
  bulbRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bulbCol: {
    flexDirection: "column",
    height: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bulb: {
    width: BULB_SIZE,
    height: BULB_SIZE,
    borderRadius: BULB_SIZE / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 4,
  },
  // Double bronze frame
  bronzeOuter: {
    width: MACHINE_W - 28,
    height: MACHINE_H - 28,
    borderWidth: 3,
    borderColor: COLORS.bronze,
    borderRadius: 22,
    padding: 4,
    backgroundColor: COLORS.black,
  },
  bronzeGap: {
    ...StyleSheet.absoluteFillObject,
    margin: 8,
    borderWidth: 1,
    borderColor: COLORS.bronzeDark,
    borderRadius: 16,
    pointerEvents: "none",
  },
  bronzeInner: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.bronzeLight,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.greenDeep,
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.green,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  titleSection: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderSection: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.bronzeLight,
    fontSize: Math.min(40, MACHINE_W * 0.1),
    letterSpacing: 3,
    textShadowColor: COLORS.bronzeDark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.bronze,
    fontSize: Math.min(14, MACHINE_W * 0.038),
    letterSpacing: 6,
    marginTop: 6,
  },
  // ===== Bronze bandeau (3-band 3D look) =====
  bandWrap: {
    width: PHOTO_W + 40,
    height: 28,
    marginVertical: 10,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.bronzeDark,
  },
  bandTop: {
    flex: 1,
    backgroundColor: COLORS.bronzeLight,
  },
  bandMid: {
    flex: 2,
    backgroundColor: COLORS.bronze,
  },
  bandBot: {
    flex: 1,
    backgroundColor: COLORS.bronzeDark,
  },
  photoFrame: {
    width: PHOTO_W + 18,
    height: PHOTO_H + 18,
    backgroundColor: COLORS.bronze,
    borderRadius: 8,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFrameInner: {
    width: PHOTO_W + 14,
    height: PHOTO_H + 14,
    backgroundColor: COLORS.black,
    borderRadius: 6,
    padding: 7,
  },
  photoMask: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: COLORS.black,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.bronzeDark,
  },
  strip: {
    width: PHOTO_W,
    flexDirection: "column",
  },
  stripItem: {
    width: PHOTO_W,
    height: PHOTO_H,
  },
  stripImage: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: "#111",
  },
  // Slider
  sliderWrap: {
    width: SLIDER_TRACK_W + 24,
    alignItems: "center",
    marginTop: 6,
  },
  sliderTrack: {
    width: SLIDER_TRACK_W,
    height: SLIDER_TRACK_H,
    backgroundColor: "#0a1f15",
    borderRadius: SLIDER_TRACK_H / 2,
    borderWidth: 2,
    borderColor: COLORS.bronzeDark,
    justifyContent: "center",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#3a1419",
    opacity: 0.7,
  },
  sliderHint: {
    color: COLORS.bronze,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
  },
  ballOuter: {
    position: "absolute",
    left: 3,
    top: 0,
    bottom: 0,
    width: BALL,
    alignItems: "center",
    justifyContent: "center",
  },
  ballInner: {
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    backgroundColor: COLORS.red,
    borderWidth: 2,
    borderColor: COLORS.bronze,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 6,
    overflow: "hidden",
    alignItems: "center",
  },
  ballHighlight: {
    position: "absolute",
    top: 6,
    width: BALL * 0.55,
    height: BALL * 0.32,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: BALL,
  },
  footerHint: {
    color: COLORS.bronze,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 6,
    opacity: 0.85,
  },
});
