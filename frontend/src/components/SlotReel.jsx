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
  const animationRef = useRef(null);
  const clickTimeoutsRef = useRef([]);
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
      if (animationRef.current) {
        try { animationRef.current.cancel(); } catch { /* ignore */ }
        animationRef.current = null;
      }
      clickTimeoutsRef.current.forEach(clearTimeout);
      clickTimeoutsRef.current = [];
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

    // Wait for the strip to be in the DOM, then animate
    const rafId = requestAnimationFrame(() => {
      const reel = reelRef.current;
      if (!reel) return;

      const endY = -(STRIP_LEN - 1) * SLOT_HEIGHT;

      const keyframes = [
        { transform: 'translate3d(0, 0, 0)', offset: 0 },
        // Ease-out cubic to just past the target (overshoot)
        { transform: `translate3d(0, ${endY - OVERSHOOT_PX}px, 0)`, offset: 0.92,
          easing: 'cubic-bezier(0.33, 0.68, 0.49, 0.98)' },
        // Gentle settle back onto the target (bounce back)
        { transform: `translate3d(0, ${endY}px, 0)`, offset: 1,
          easing: 'cubic-bezier(0.34, 0, 0.64, 1)' },
      ];

      const anim = reel.animate(keyframes, {
        duration: SPIN_DURATION,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        fill: 'forwards',
      });
      animationRef.current = anim;

      // Schedule click sounds — one per photo transition, timed to the ease-out curve
      // Inverse of ease-out cubic: t = 1 - (1 - y)^(1/3)
      // We map to the first 92% of the duration (before overshoot)
      for (let i = 1; i < STRIP_LEN; i++) {
        const y = i / (STRIP_LEN - 1);
        const t = 1 - Math.pow(1 - y, 1 / 3);
        const time = t * SPIN_DURATION * 0.92;
        const tid = setTimeout(() => { if (onPhotoChange) onPhotoChange(); }, time);
        clickTimeoutsRef.current.push(tid);
      }

      anim.onfinish = () => {
        animationRef.current = null;
        setCurrentIndex(finalIndexRef.current);
        setStrip([]);
        if (onSpinComplete && photos[finalIndexRef.current]) {
          onSpinComplete(photos[finalIndexRef.current]);
        }
      };
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (animationRef.current) {
        try { animationRef.current.cancel(); } catch { /* ignore */ }
        animationRef.current = null;
      }
      clickTimeoutsRef.current.forEach(clearTimeout);
      clickTimeoutsRef.current = [];
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
      {/* Viewport: 250x250, no black border */}
      <div
        className={`relative rounded-sm shadow-xl overflow-hidden transform transition-transform duration-300 ${
          spinning ? 'scale-95' : 'scale-100'
        }`}
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
                    width: '102%',
                    height: '102%',
                    objectFit: 'cover',
                    marginLeft: '-1%',
                    marginTop: '-1%',
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
              width: '102%',
              height: '102%',
              objectFit: 'cover',
              marginLeft: '-1%',
              marginTop: '-1%',
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Top/bottom gradient overlays (visible during spin for depth) */}
      <div
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10 transition-opacity duration-300"
        style={{ opacity: spinning ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10 transition-opacity duration-300"
        style={{ opacity: spinning ? 1 : 0 }}
      />
    </div>
  );
}
