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
  const finalIndexRef = useRef(0);

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
      return;
    }

    // Build strip: start with currently displayed photo (seamless),
    // middle random, end = new random target
    const finalIdx = getSecureRandomIndex(photos.length);
    finalIndexRef.current = finalIdx;

    const newStrip = new Array(STRIP_LEN);
    newStrip[0] = photos[currentIndex];
    for (let i = 1; i < STRIP_LEN - 1; i++) {
      newStrip[i] = photos[getSecureRandomIndex(photos.length)];
    }
    newStrip[STRIP_LEN - 1] = photos[finalIdx];
    setStrip(newStrip);

    // Wait for the strip to be in the DOM, then start the rAF-driven animation.
    // We drive transform AND click sounds from the SAME loop so they can never
    // drift apart. The click for photo i fires the very frame the strip crosses
    // -i * SLOT_HEIGHT — i.e. when photo i becomes the centered one.
    const initialRaf = requestAnimationFrame(() => {
      const reel = reelRef.current;
      if (!reel) return;

      const endY = -(STRIP_LEN - 1) * SLOT_HEIGHT;     // -4250 (final settle)
      const peakY = endY - OVERSHOOT_PX;               // -4264 (overshoot peak at 92%)
      const easeOutPhase = SPIN_DURATION * 0.92;       // 0 → 92%: ease-out cubic
      const settlePhase = SPIN_DURATION - easeOutPhase; // 92 → 100%: gentle settle

      const startTime = performance.now();
      let nextTickIdx = 1; // next photo boundary to "click" on (1..STRIP_LEN-1)

      const tick = (now) => {
        const elapsed = now - startTime;
        let scroll;

        if (elapsed >= SPIN_DURATION) {
          // Final frame — clamp to endY and finish
          reel.style.transform = `translate3d(0, ${endY}px, 0)`;

          // Fire any remaining ticks (safety net — should already be done)
          while (nextTickIdx < STRIP_LEN) {
            if (onPhotoChange) onPhotoChange();
            nextTickIdx++;
          }

          rafRef.current = null;
          setCurrentIndex(finalIndexRef.current);
          setStrip([]);
          if (onSpinComplete && photos[finalIndexRef.current]) {
            onSpinComplete(photos[finalIndexRef.current]);
          }
          return;
        }

        if (elapsed <= easeOutPhase) {
          // Ease-out cubic: y = 1 - (1 - t)^3 — fast → slow (rythme préservé)
          const t = elapsed / easeOutPhase;
          const y = 1 - Math.pow(1 - t, 3);
          scroll = y * peakY;
        } else {
          // Settle back from peakY (-4264) to endY (-4250) — smoothstep
          const t = (elapsed - easeOutPhase) / settlePhase;
          const ease = t * t * (3 - 2 * t);
          scroll = peakY + (endY - peakY) * ease;
        }

        reel.style.transform = `translate3d(0, ${scroll}px, 0)`;

        // Fire a click each time the strip crosses a photo boundary.
        // Photo at position i is centered when scroll === -i * SLOT_HEIGHT.
        // -scroll grows monotonically during the ease-out phase, so this
        // catches every crossing without missing or duplicating any.
        const absScroll = -scroll;
        while (
          nextTickIdx < STRIP_LEN &&
          absScroll >= nextTickIdx * SLOT_HEIGHT
        ) {
          if (onPhotoChange) onPhotoChange();
          nextTickIdx++;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(initialRaf);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
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
