import React, { useState, useEffect, useRef } from 'react';

// Detect mobile once at module load
const IS_MOBILE_UA = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

// Cryptographically secure random number generator
function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export default function SlotReel({ photos, isSpinning, onSpinComplete, onPhotoChange }) {
  // currentIndex drives the static (non-spinning) render. During spin we bypass React.
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined' && photos && photos.length > 0) {
      return getSecureRandomIndex(photos.length);
    }
    return 0;
  });

  // DOM refs — mutated directly during animation, zero React re-renders
  const reelRef = useRef(null);
  const currentImgRef = useRef(null);
  const prevImgRef = useRef(null);
  const nextImgRef = useRef(null);
  const prevWrapperRef = useRef(null);
  const nextWrapperRef = useRef(null);
  const centerWrapperRef = useRef(null);

  const animationRef = useRef(null);

  // Reset to random photo when photos change (app reopened)
  useEffect(() => {
    if (photos && photos.length > 0 && !isSpinning) {
      setCurrentIndex(getSecureRandomIndex(photos.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  useEffect(() => {
    if (!isSpinning || photos.length === 0) {
      // reset container transform/filter when idle
      if (reelRef.current) {
        reelRef.current.style.transform = 'translate3d(0, 0, 0)';
        reelRef.current.style.filter = 'none';
      }
      if (prevWrapperRef.current) prevWrapperRef.current.style.opacity = '0';
      if (nextWrapperRef.current) nextWrapperRef.current.style.opacity = '0';
      return;
    }

    const PHOTO_HEIGHT = 300;
    const TOTAL_SPIN_TIME = 2500;
    const startTime = Date.now();

    // Secure random target
    const randomStart = getSecureRandomIndex(photos.length);
    const scrollClicks = 12 + getSecureRandomIndex(5);
    const totalDistance = scrollClicks * PHOTO_HEIGHT;

    let lastVisualIdx = randomStart;

    // Seed the DOM imgs for the starting position
    const setImg = (ref, idx) => {
      if (!ref.current) return;
      const norm = ((idx % photos.length) + photos.length) % photos.length;
      const src = photos[norm]?.src;
      if (src && ref.current.src !== src) ref.current.src = src;
    };
    setImg(currentImgRef, randomStart);
    setImg(prevImgRef, randomStart - 1);
    setImg(nextImgRef, randomStart + 1);

    // Scale down the center card during spin
    if (centerWrapperRef.current) centerWrapperRef.current.style.transform = 'scale(0.95)';

    let finalIdx = randomStart;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / TOTAL_SPIN_TIME, 1);

      // Ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const currentDistance = totalDistance * easedProgress;
      const rawOffset = currentDistance % PHOTO_HEIGHT;
      const clicksCompleted = Math.floor(currentDistance / PHOTO_HEIGHT);

      const visualIdx = rawOffset > PHOTO_HEIGHT * 0.4
        ? (randomStart + clicksCompleted + 1) % photos.length
        : (randomStart + clicksCompleted) % photos.length;

      const visualOffset = rawOffset > PHOTO_HEIGHT * 0.4
        ? (rawOffset - PHOTO_HEIGHT) * (1 - Math.pow(progress, 4))
        : rawOffset * (1 - Math.pow(progress, 4));

      const speed = Math.pow(1 - progress, 2) * 60;
      const blurAmount = IS_MOBILE_UA ? 0 : Math.min(speed / 6, 6);
      const normalizedOffset = visualOffset / PHOTO_HEIGHT;

      // Direct DOM mutations — no React re-render
      if (reelRef.current) {
        reelRef.current.style.transform = `translate3d(0, ${visualOffset * 0.3}px, 0)`;
        reelRef.current.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';
      }
      if (prevWrapperRef.current) {
        prevWrapperRef.current.style.opacity = String(0.5 + normalizedOffset * 0.3);
      }
      if (nextWrapperRef.current) {
        nextWrapperRef.current.style.opacity = String(0.5 - normalizedOffset * 0.3);
      }

      // Update image sources only when the visible photo actually changes
      if (visualIdx !== lastVisualIdx) {
        lastVisualIdx = visualIdx;
        finalIdx = visualIdx;
        setImg(currentImgRef, visualIdx);
        setImg(prevImgRef, visualIdx - 1);
        setImg(nextImgRef, visualIdx + 1);
        if (onPhotoChange) onPhotoChange();
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete — settle final state
        if (reelRef.current) {
          reelRef.current.style.transform = 'translate3d(0, 0, 0)';
          reelRef.current.style.filter = 'none';
        }
        if (prevWrapperRef.current) prevWrapperRef.current.style.opacity = '0';
        if (nextWrapperRef.current) nextWrapperRef.current.style.opacity = '0';
        if (centerWrapperRef.current) centerWrapperRef.current.style.transform = 'scale(1)';
        setCurrentIndex(finalIdx);
        if (onSpinComplete && photos[finalIdx]) {
          onSpinComplete(photos[finalIdx]);
        }
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, photos]);

  if (photos.length === 0) return null;

  // Static render for idle state — during spin the JSX doesn't change,
  // only the DOM nodes' styles via refs.
  const getPhotoAtIndex = (idx) => {
    const normalizedIdx = ((idx % photos.length) + photos.length) % photos.length;
    return photos[normalizedIdx];
  };
  const displayPhoto = getPhotoAtIndex(currentIndex);
  const prevPhoto = getPhotoAtIndex(currentIndex - 1);
  const nextPhoto = getPhotoAtIndex(currentIndex + 1);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Scrolling reel container */}
      <div
        ref={reelRef}
        className="relative"
        style={{
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
        }}
      >
        {/* Previous photo (entering from top) */}
        <div
          ref={prevWrapperRef}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: '-260px', opacity: 0, willChange: 'opacity' }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
              ref={prevImgRef}
              src={prevPhoto?.src}
              alt=""
              loading="eager"
              decoding="async"
              className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
            />
          </div>
        </div>

        {/* Current photo (center) */}
        <div
          ref={centerWrapperRef}
          className="border-[3px] border-black rounded-sm shadow-xl overflow-hidden"
          style={{
            width: '250px',
            height: '250px',
            transform: 'scale(1)',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <img
            ref={currentImgRef}
            src={displayPhoto?.src}
            alt=""
            loading="eager"
            decoding="async"
            className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
          />
        </div>

        {/* Next photo (exiting to bottom) */}
        <div
          ref={nextWrapperRef}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: '-260px', opacity: 0, willChange: 'opacity' }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
              ref={nextImgRef}
              src={nextPhoto?.src}
              alt=""
              loading="eager"
              decoding="async"
              className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
            />
          </div>
        </div>
      </div>

      {/* Top shadow overlay */}
      <div
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10 transition-opacity duration-300"
        style={{ opacity: isSpinning ? 1 : 0 }}
      />

      {/* Bottom shadow overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10 transition-opacity duration-300"
        style={{ opacity: isSpinning ? 1 : 0 }}
      />
    </div>
  );
}
