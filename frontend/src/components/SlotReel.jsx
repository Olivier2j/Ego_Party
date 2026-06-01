import React, { useState, useEffect, useRef } from 'react';

// Cryptographically secure random integer in [0, max)
function getSecureRandomIndex(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

// Strip configuration
const STRIP_LEN = 18;          // photos in the scrolling strip
const SLOT_HEIGHT = 250;       // each photo slot vertical size (matches 250x250 viewport)
const SPIN_DURATION = 2500;    // ms
const OVERSHOOT_PX = 14;       // "bounce back" past target before settling
const RECENT_HISTORY = 30;     // anti-repeat window for the final picked photo

/**
 * Slot reel using a pre-built strip + GPU-composited CSS animation via
 * Web Animations API. Zero React re-renders during the spin — all motion
 * happens on the compositor thread, which gives consistent fluidity on
 * mobile (iPad/iPhone) as well as desktop.
 */
export default function SlotReel({ photos, isSpinning, onSpinComplete, onPhotoChange }) {
  const [currentIndex, setCurrentIndex] = useState(() => (
    photos && photos.length > 0 ? getSecureRandomIndex(photos.length) : 0
  ));
  // Strip is populated only while spinning
  const [strip, setStrip] = useState([]);

  const reelRef = useRef(null);
  const rafRef = useRef(null);
  const animRef = useRef(null);
  const finishTimerRef = useRef(null);
  const finalIndexRef = useRef(0);
  // Sliding window of recently picked final indices — avoids visible repeats
  // while keeping pure randomness (we just resample if we land on a recent one).
  // Disabled automatically when photos.length <= RECENT_HISTORY.
  const recentIndicesRef = useRef([]);

  // Pick a uniformly random index that isn't in the recent-history window.
  // Falls back to pure random if anti-repeat would leave no valid choice.
  const pickNonRecentIndex = (len) => {
    if (len <= RECENT_HISTORY) return getSecureRandomIndex(len);
    const recent = new Set(recentIndicesRef.current);
    // Bounded retry — with len > RECENT_HISTORY, expected tries is < 1.5
    for (let tries = 0; tries < 50; tries++) {
      const idx = getSecureRandomIndex(len);
      if (!recent.has(idx)) return idx;
    }
    return getSecureRandomIndex(len); // safety fallback (statistically unreachable)
  };

  const pushRecent = (idx) => {
    const hist = recentIndicesRef.current;
    hist.push(idx);
    if (hist.length > RECENT_HISTORY) hist.shift();
  };

  // Pick a new random photo whenever the photo set is (re)loaded and we're idle
  useEffect(() => {
    if (photos && photos.length > 0 && !isSpinning) {
      setCurrentIndex(getSecureRandomIndex(photos.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  useEffect(() => {
    if (!isSpinning || photos.length === 0) {
      // Cleanup if we were spinning
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (animRef.current) {
        try { animRef.current.cancel(); } catch { /* ignore */ }
        animRef.current = null;
      }
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      return;
    }

    // Build strip: start with currently displayed photo (seamless),
    // middle random, end = new random target (anti-repeat for the final pick)
    const finalIdx = pickNonRecentIndex(photos.length);
    finalIndexRef.current = finalIdx;
    pushRecent(finalIdx);

    const newStrip = new Array(STRIP_LEN);
    newStrip[0] = photos[currentIndex];
    for (let i = 1; i < STRIP_LEN - 1; i++) {
      newStrip[i] = photos[getSecureRandomIndex(photos.length)];
    }
    newStrip[STRIP_LEN - 1] = photos[finalIdx];
    setStrip(newStrip);

    // Animation strategy (mobile-safe, especially iOS Safari):
    //   • Web Animations API (reel.animate) for the visual transform — runs on
    //     the compositor thread, NEVER pauses even if the main thread is busy
    //     (image decoding, GC, scroll inertia). This is critical for iPhone:
    //     a pure rAF main-thread animation will freeze visually mid-spin.
    //   • A lightweight rAF loop just READS anim.currentTime and fires the
    //     click sounds when the curve crosses each photo boundary. If iOS
    //     throttles the rAF, the visual keeps going and we catch up the
    //     missed clicks on the next tick.
    //   • A setTimeout fallback guarantees onSpinComplete fires even if
    //     anim.onfinish is dropped by iOS (known WebKit quirk).
    const startSpin = () => {
      const reel = reelRef.current;
      if (!reel) return;

      const endY = -(STRIP_LEN - 1) * SLOT_HEIGHT;     // -4250
      const peakY = endY - OVERSHOOT_PX;               // -4264

      // Web Animations API — runs on compositor, immune to main-thread jank
      const keyframes = [
        { transform: 'translate3d(0, 0, 0)', offset: 0 },
        { transform: `translate3d(0, ${peakY}px, 0)`, offset: 0.92,
          easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }, // canonical ease-out cubic
        { transform: `translate3d(0, ${endY}px, 0)`, offset: 1,
          easing: 'cubic-bezier(0.34, 0, 0.64, 1)' },
      ];

      let anim;
      try {
        anim = reel.animate(keyframes, {
          duration: SPIN_DURATION,
          fill: 'forwards',
        });
      } catch {
        // Extremely old browsers — fall back to a static transform; spin will
        // still resolve via the finishTimer below.
        reel.style.transform = `translate3d(0, ${endY}px, 0)`;
      }
      animRef.current = anim || null;

      // Lightweight rAF loop: read currentTime, fire clicks at boundary crossings.
      // peakY is reached at 92% of duration via ease-out cubic. We invert:
      //   y(t) = 1 - (1-t)^3  →  scroll = y * peakY  (for t ∈ [0, 0.92])
      // Beyond 92% we just clamp to endY for click purposes.
      const easeOutPhase = SPIN_DURATION * 0.92;
      let nextTickIdx = 1;

      const tickClicks = () => {
        const t = anim ? (anim.currentTime || 0) : performance.now() - spinStart;
        let absScroll;
        if (t <= easeOutPhase) {
          const u = t / easeOutPhase;
          const y = 1 - Math.pow(1 - u, 3);
          absScroll = Math.abs(y * peakY);
        } else {
          absScroll = Math.abs(endY);
        }
        while (nextTickIdx < STRIP_LEN && absScroll >= nextTickIdx * SLOT_HEIGHT) {
          if (onPhotoChange) onPhotoChange();
          nextTickIdx++;
        }
        if (nextTickIdx < STRIP_LEN) {
          rafRef.current = requestAnimationFrame(tickClicks);
        } else {
          rafRef.current = null;
        }
      };
      const spinStart = performance.now(); // fallback time source
      rafRef.current = requestAnimationFrame(tickClicks);

      // Finalisation: prefer anim.onfinish, but ALWAYS have a timer fallback
      // because iOS Safari sometimes drops the 'finish' event when the tab
      // is backgrounded, the user touches the screen, or memory is tight.
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        if (finishTimerRef.current) {
          clearTimeout(finishTimerRef.current);
          finishTimerRef.current = null;
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // Make sure remaining clicks fire (catch-up if rAF was throttled)
        while (nextTickIdx < STRIP_LEN) {
          if (onPhotoChange) onPhotoChange();
          nextTickIdx++;
        }
        animRef.current = null;
        setCurrentIndex(finalIndexRef.current);
        setStrip([]);
        if (onSpinComplete && photos[finalIndexRef.current]) {
          onSpinComplete(photos[finalIndexRef.current]);
        }
      };

      if (anim) {
        anim.onfinish = finalize;
      }
      // Safety net: +200ms after expected end → finalize anyway
      finishTimerRef.current = setTimeout(finalize, SPIN_DURATION + 200);
    };

    // Wait one rAF so the strip is mounted in the DOM, then start.
    const initialRaf = requestAnimationFrame(startSpin);

    return () => {
      cancelAnimationFrame(initialRaf);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (animRef.current) {
        try { animRef.current.cancel(); } catch { /* ignore */ }
        animRef.current = null;
      }
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, photos]);

  if (photos.length === 0) return null;

  const getPhotoAtIndex = (idx) => {
    const n = ((idx % photos.length) + photos.length) % photos.length;
    return photos[n];
  };
  const displayPhoto = getPhotoAtIndex(currentIndex);
  const spinning = strip.length > 0;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Viewport: 250x250, no black border, no scale change between spinning/idle */}
      <div
        className="relative rounded-sm shadow-xl overflow-hidden"
        style={{ width: '250px', height: `${SLOT_HEIGHT}px` }}
      >
        {spinning ? (
          <div
            ref={reelRef}
            style={{
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          >
            {strip.map((photo, i) => (
              <div
                key={i}
                style={{
                  width: '250px',
                  height: `${SLOT_HEIGHT}px`,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={photo?.src}
                  alt=""
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <img
            src={displayPhoto?.src}
            alt=""
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 'none',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </div>
    </div>
  );
}
