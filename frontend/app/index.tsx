import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
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

// Slider — track shortened by 10% relative to previous version
const SLIDER_TRACK_W = MACHINE_W * 0.78 * 0.9;
const SLIDER_TRACK_H = 56;
const BALL = 44;
const SLIDER_MAX = SLIDER_TRACK_W - BALL - 6;

// Bulbs
const BULB_SIZE = 12;
const BULBS_PER_ROW = Math.floor((MACHINE_W - 24) / 22);
const BULBS_PER_COL = Math.floor((MACHINE_H - 24) / 28);

// Animation constants
const STRIP_ITEMS = 18; // photos in scroll strip (= ticks count + 1)
const SPIN_DURATION = 2500;
const ACTIVE_RATIO = 0.92; // photos travel during the first 92% of duration
const DING_DURATION = 2090;

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
        <View key={i} style={styles.stripItem}>
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
  // Initial photo + strip share the same first index so the always-mounted
  // PhotoStrip at translateY=0 visually matches the "current" photo (no
  // flash at first spin start when stripIndices is replaced).
  const initialIdxRef = useRef<number>(cryptoRandomInt(PHOTO_COUNT));
  const [currentIdx, setCurrentIdx] = useState<number>(initialIdxRef.current);
  const [stripIndices, setStripIndices] = useState<number[]>(() => {
    const arr: number[] = [];
    arr.push(initialIdxRef.current);
    for (let i = 1; i < STRIP_ITEMS; i++) arr.push(cryptoRandomInt(PHOTO_COUNT));
    return arr;
  });
  const [spinning, setSpinning] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [bulbTick, setBulbTick] = useState(0);
  const [titleBlink, setTitleBlink] = useState(true);

  const lastIdxRef = useRef<number>(currentIdx);
  const clicksReelRef = useRef<Audio.Sound | null>(null);
  const dingSoundRef = useRef<Audio.Sound | null>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ===== Web-only Web Audio API for iOS Safari low-latency playback =====
  // Primary path = Web Audio API (low latency).
  // Fallback path = HTMLAudioElement (high latency but more compatible).
  // If decodeAudioData fails on Safari for any reason, HTMLAudio takes over.
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const webReelBufferRef = useRef<AudioBuffer | null>(null);
  const webDingBufferRef = useRef<AudioBuffer | null>(null);
  const webReelElRef = useRef<HTMLAudioElement | null>(null);
  const webDingElRef = useRef<HTMLAudioElement | null>(null);
  const webAudioUnlockedRef = useRef(false);
  // Raw ArrayBuffers cached at load — decoded only inside the FIRST user
  // gesture (iOS Safari requirement: AudioContext born outside a gesture
  // remains silent even after .resume()).
  const reelArrBufRef = useRef<ArrayBuffer | null>(null);
  const dingArrBufRef = useRef<ArrayBuffer | null>(null);

  const translateY = useSharedValue(0);

  // Visible debug indicator (web only) so we can pinpoint iOS Safari audio
  // failure points. WA=AudioContext, BUF=decoded buffers, EL=HTMLAudio elements,
  // UNLK=unlock fired, PATH=last play path, N=play count.
  const [audioDbg, setAudioDbg] = useState({
    ctx: false,
    reelBuf: false,
    dingBuf: false,
    reelEl: false,
    dingEl: false,
    unlocked: false,
    lastPath: "—",
    plays: 0,
  });

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

      // Pre-load sounds. The "click reel" is a SINGLE pre-rendered WAV
      // containing all 17 clicks at the exact instants computed from
      // easeOutCubicInverse(k/(N-1)) * SPIN_DURATION * ACTIVE_RATIO.
      // Playing one audio file (vs. 17 setTimeout calls to replayAsync)
      // bypasses iOS's variable per-replay latency → perfect sync with
      // the visual photo transitions.
      try {
        const reelPromise = Audio.Sound.createAsync(
          require("../assets/sounds/clicks_reel.wav"),
          { volume: 0.85 }
        )
          .then((r) => r.sound)
          .catch(() => null);

        const dingPromise = Audio.Sound.createAsync(
          require("../assets/sounds/ding.mp3"),
          { volume: 1.0 }
        )
          .then((r) => r.sound)
          .catch(() => null);

        const [reel, ding] = await Promise.all([reelPromise, dingPromise]);
        if (cancelled) return;
        clicksReelRef.current = reel;
        dingSoundRef.current = ding;
      } catch {}

      // On web, build a parallel Web Audio API pipeline (AudioContext +
      // pre-decoded AudioBuffers) so playback latency is <50 ms on iOS Safari
      // instead of ~1 s with HTMLAudioElement. The AudioContext is created
      // eagerly in suspended state; we will .resume() it on the first user
      // touch (see unlockWebAudio).
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
          const reelAsset = Asset.fromModule(
            require("../assets/sounds/clicks_reel.wav")
          );
          const dingAsset = Asset.fromModule(
            require("../assets/sounds/ding.mp3")
          );
          await Promise.all([
            reelAsset.downloadAsync().catch(() => {}),
            dingAsset.downloadAsync().catch(() => {}),
          ]);
          // --- HTMLAudio fallback elements (always created) ---
          let elReel = false;
          let elDing = false;
          try {
            const reelEl = new window.Audio(reelAsset.uri);
            reelEl.preload = "auto";
            reelEl.volume = 0.85;
            reelEl.load();
            webReelElRef.current = reelEl;
            elReel = true;
            const dingEl = new window.Audio(dingAsset.uri);
            dingEl.preload = "auto";
            dingEl.volume = 1.0;
            dingEl.load();
            webDingElRef.current = dingEl;
            elDing = true;
          } catch {}
          setAudioDbg((d) => ({ ...d, reelEl: elReel, dingEl: elDing }));
          // CRITICAL iOS Safari/WebKit constraint:
          // We do NOT create the AudioContext here. iOS WebKit only activates
          // the audio hardware when the AudioContext is *constructed* inside
          // a user gesture handler. Even resume() on a pre-built ctx stays
          // silent. So we only PREFETCH the raw ArrayBuffers here, then the
          // context + decode happen lazily inside unlockWebAudio() on the
          // first touch.
          try {
            const [reelArr, dingArr] = await Promise.all([
              fetch(reelAsset.uri)
                .then((r) => r.arrayBuffer())
                .catch(() => null),
              fetch(dingAsset.uri)
                .then((r) => r.arrayBuffer())
                .catch(() => null),
            ]);
            reelArrBufRef.current = reelArr;
            dingArrBufRef.current = dingArr;
          } catch {}
        } catch {}
      }

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
      if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);
      clicksReelRef.current?.unloadAsync().catch(() => {});
      dingSoundRef.current?.unloadAsync().catch(() => {});
      try {
        webAudioCtxRef.current?.close();
      } catch {}
    };
  }, []);

  // ===== Web playback: Web Audio API primary, HTMLAudio fallback =====
  const playBuffer = useCallback((buf: AudioBuffer | null, gainVal: number) => {
    const ctx = webAudioCtxRef.current;
    if (!ctx || !buf) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = gainVal;
      src.connect(gain).connect(ctx.destination);
      src.start(0);
      return true;
    } catch {
      return false;
    }
  }, []);

  const playHtmlAudio = useCallback((el: HTMLAudioElement | null) => {
    if (!el) return false;
    try {
      el.pause();
      el.currentTime = 0;
      el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, []);

  const playClicksReel = useCallback(() => {
    if (Platform.OS === "web") {
      if (playBuffer(webReelBufferRef.current, 0.85)) {
        setAudioDbg((d) => ({ ...d, lastPath: "WA", plays: d.plays + 1 }));
        return;
      }
      if (playHtmlAudio(webReelElRef.current)) {
        setAudioDbg((d) => ({ ...d, lastPath: "HA", plays: d.plays + 1 }));
        return;
      }
      setAudioDbg((d) => ({ ...d, lastPath: "NONE", plays: d.plays + 1 }));
      return;
    }
    const s = clicksReelRef.current;
    if (!s) return;
    s.replayAsync().catch(() => {});
  }, [playBuffer, playHtmlAudio]);

  const playDing = useCallback(() => {
    if (Platform.OS === "web") {
      if (playBuffer(webDingBufferRef.current, 1.0)) return;
      playHtmlAudio(webDingElRef.current);
      return;
    }
    const s = dingSoundRef.current;
    if (!s) return;
    s.replayAsync().catch(() => {});
  }, [playBuffer, playHtmlAudio]);

  // iOS-Safari audio unlock + LAZY AudioContext creation. MUST run inside a
  // synchronous user-gesture handler — the AudioContext is born here so that
  // iOS WebKit (Safari and Chrome iOS, both use WebKit) actually activates
  // the audio hardware. Decoding the cached ArrayBuffers also happens here.
  const unlockWebAudio = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (webAudioUnlockedRef.current) return;
    webAudioUnlockedRef.current = true;
    // ---- Create AudioContext NOW (in user gesture) ----
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    let ctxCreated = false;
    let ctx: AudioContext | null = null;
    if (Ctx) {
      try {
        ctx = new Ctx();
        webAudioCtxRef.current = ctx;
        ctxCreated = true;
        // Prime silent buffer to fully wake the iOS audio session
        const silent = ctx!.createBuffer(1, 1, 22050);
        const silentSrc = ctx!.createBufferSource();
        silentSrc.buffer = silent;
        silentSrc.connect(ctx!.destination);
        silentSrc.start(0);
        if (ctx!.state === "suspended") {
          ctx!.resume().catch(() => {});
        }
      } catch {}
    }
    // ---- Decode the cached ArrayBuffers (async, but the context is now alive) ----
    if (ctx && reelArrBufRef.current && dingArrBufRef.current) {
      const decode = (buf: ArrayBuffer) =>
        new Promise<AudioBuffer | null>((resolve) => {
          try {
            const p = ctx!.decodeAudioData(
              buf.slice(0),
              (b) => resolve(b),
              () => resolve(null)
            );
            if (p && typeof (p as Promise<AudioBuffer>).then === "function") {
              (p as Promise<AudioBuffer>).then(
                (b) => resolve(b),
                () => resolve(null)
              );
            }
          } catch {
            resolve(null);
          }
        });
      Promise.all([
        decode(reelArrBufRef.current),
        decode(dingArrBufRef.current),
      ]).then(([r, d]) => {
        webReelBufferRef.current = r;
        webDingBufferRef.current = d;
        setAudioDbg((s) => ({
          ...s,
          ctx: ctxCreated,
          reelBuf: !!r,
          dingBuf: !!d,
        }));
      });
    }
    // ---- HTMLAudio fallback unlock (muted play+pause+rewind) ----
    const warm = (el: HTMLAudioElement | null) => {
      if (!el) return;
      try {
        const prevVol = el.volume;
        el.muted = true;
        const p = el.play();
        const restore = () => {
          try {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
            el.volume = prevVol;
          } catch {}
        };
        if (p && typeof (p as Promise<void>).then === "function") {
          (p as Promise<void>).then(restore).catch(restore);
        } else {
          restore();
        }
      } catch {}
    };
    warm(webReelElRef.current);
    warm(webDingElRef.current);
    setAudioDbg((d) => ({ ...d, ctx: ctxCreated, unlocked: true }));
  }, []);

  // Belt-and-suspenders: also attach a native DOM listener on document so
  // the unlock fires for ANY first user gesture (even if RN-Web's
  // onTouchStart wrapper somehow loses the user-gesture flag on Safari).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const fire = () => {
      unlockWebAudio();
      document.removeEventListener("touchstart", fire, true);
      document.removeEventListener("touchend", fire, true);
      document.removeEventListener("pointerdown", fire, true);
      document.removeEventListener("mousedown", fire, true);
      document.removeEventListener("click", fire, true);
    };
    document.addEventListener("touchstart", fire, { capture: true, passive: true });
    document.addEventListener("touchend", fire, true);
    document.addEventListener("pointerdown", fire, true);
    document.addEventListener("mousedown", fire, true);
    document.addEventListener("click", fire, true);
    return () => {
      document.removeEventListener("touchstart", fire, true);
      document.removeEventListener("touchend", fire, true);
      document.removeEventListener("pointerdown", fire, true);
      document.removeEventListener("mousedown", fire, true);
      document.removeEventListener("click", fire, true);
    };
  }, [unlockWebAudio]);

  // ===== Strip image pre-decoder (web only) =====
  // The 18 photos in the strip start to scroll FAST (~45 ms between the first
  // two) — on Android Chrome the browser hasn't finished decoding them when
  // their `<img>` would normally paint, resulting in black flashes during the
  // first half of the spin. We pre-create HTMLImageElements and `await
  // .decode()` for each strip photo BEFORE starting the animation. No-op on
  // native (RN Image caches its own bitmaps).
  const decodeStripImages = useCallback(async (indices: number[]) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      await Promise.all(
        indices.map((idx) => {
          return new Promise<void>((resolve) => {
            try {
              const asset = Asset.fromModule(PHOTOS[idx]);
              const url = asset.uri || asset.localUri || "";
              if (!url) {
                resolve();
                return;
              }
              const img = new window.Image();
              const done = () => resolve();
              img.onload = () => {
                if (typeof (img as any).decode === "function") {
                  (img as HTMLImageElement)
                    .decode()
                    .then(done)
                    .catch(done);
                } else {
                  done();
                }
              };
              img.onerror = done;
              img.src = url;
            } catch {
              resolve();
            }
          });
        })
      );
    } catch {}
  }, []);

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

    // Pre-decode the 18 strip photos on web BEFORE starting the animation
    // (no-op on native). Then animate + play audio. The pre-decode wait
    // (~50-150 ms) is invisible: it happens between the slider release and
    // the visible strip movement.
    const target = -(STRIP_ITEMS - 1) * PHOTO_H;
    const start = () => {
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
        playClicksReel();
      });
    };

    if (Platform.OS === "web") {
      decodeStripImages(newStrip).then(start);
    } else {
      start();
    }
  }, [
    assetsReady,
    decodeStripImages,
    playClicksReel,
    spinning,
    translateY,
  ]);

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

      // Title blink (red ↔ bronze) synced with ding (~2090 ms)
      const blinkInterval = 180; // ~11 toggles ≈ 2030 ms
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
    <SafeAreaView
      style={styles.root}
      testID="ego-party-screen"
      // Web/iOS-Safari only: unlock <audio> elements on the first user touch
      // anywhere in the app. No-op on native (onTouchStart is a regular
      // RN prop and just gets ignored if we don't use the responder system).
      onTouchStart={unlockWebAudio}
    >
      {Platform.OS === "web" && (
        <View
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            right: 4,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: 4,
          }}
          pointerEvents="none"
        >
          <Text style={{ color: "#0f0", fontSize: 10, fontFamily: "monospace" }}>
            {`WA:${audioDbg.ctx ? "✓" : "✗"} `}
            {`BUF:${audioDbg.reelBuf ? "✓" : "✗"}${audioDbg.dingBuf ? "✓" : "✗"} `}
            {`EL:${audioDbg.reelEl ? "✓" : "✗"}${audioDbg.dingEl ? "✓" : "✗"} `}
            {`UNLK:${audioDbg.unlocked ? "✓" : "✗"} `}
            {`PATH:${audioDbg.lastPath} N:${audioDbg.plays}`}
          </Text>
        </View>
      )}
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
                      {/* Always render the PhotoStrip — never swap with a
                          static <Image>. When idle, translateY is 0 and
                          stripIndices[0] is the current photo, so visually
                          it's identical to a static image but there is no
                          mount/unmount flash at spin start. */}
                      <PhotoStrip
                        translateY={translateY}
                        stripIndices={stripIndices}
                      />
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
