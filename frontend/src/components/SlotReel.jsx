import React, { useState, useEffect, useRef } from 'react';

// Detect mobile once
const IS_MOBILE_UA = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

// Cryptographically secure random number generator
function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export default function SlotReel({ photos, isSpinning, onSpinComplete, onPhotoChange }) {
  // Initialize with a random index on mount
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined' && photos && photos.length > 0) {
      return getSecureRandomIndex(photos.length);
    }
    return 0;
  });
  const [offset, setOffset] = useState(0);
  const [speed, setSpeed] = useState(0);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const totalSpinTimeRef = useRef(3000);
  const finalIndexRef = useRef(0);

  // Reset to random photo when photos change (app reopened with new photos)
  useEffect(() => {
    if (photos && photos.length > 0 && !isSpinning) {
      const randomIndex = getSecureRandomIndex(photos.length);
      setCurrentIndex(randomIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  useEffect(() => {
    if (isSpinning && photos.length > 0) {
      startTimeRef.current = Date.now();
      totalSpinTimeRef.current = 2500;
      
      const photoHeight = 300;
      
      // Secure random starting point for each spin
      const randomStart = getSecureRandomIndex(photos.length);
      // Random number of clicks (12-16) for extra unpredictability
      const scrollClicks = 12 + getSecureRandomIndex(5);
      const totalDistance = scrollClicks * photoHeight;
      
      let lastDisplayedIndex = randomStart;
      setCurrentIndex(randomStart);
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / totalSpinTimeRef.current, 1);
        
        // Ease-out cubic: FAST at start, SLOW at end
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        // Calculate current position
        const currentDistance = totalDistance * easedProgress;
        const rawOffset = currentDistance % photoHeight;
        
        // Determine which photo is visually dominant
        const clicksCompleted = Math.floor(currentDistance / photoHeight);
        const visualPhotoIndex = rawOffset > photoHeight * 0.4 
          ? (randomStart + clicksCompleted + 1) % photos.length
          : (randomStart + clicksCompleted) % photos.length;
        
        // Offset relative to the visual photo
        const visualOffset = rawOffset > photoHeight * 0.4
          ? (rawOffset - photoHeight) * (1 - Math.pow(progress, 4))
          : rawOffset * (1 - Math.pow(progress, 4));
        
        // Update speed for blur effect
        const speed = Math.pow(1 - progress, 2) * 60;
        setSpeed(speed);
        setOffset(visualOffset);
        
        // Update displayed photo
        if (visualPhotoIndex !== lastDisplayedIndex) {
          lastDisplayedIndex = visualPhotoIndex;
          setCurrentIndex(visualPhotoIndex);
          finalIndexRef.current = visualPhotoIndex;
          
          if (onPhotoChange) {
            onPhotoChange();
          }
        }
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - keep the visually displayed photo
          setOffset(0);
          setSpeed(0);
          setCurrentIndex(finalIndexRef.current);
          
          if (onSpinComplete && photos[finalIndexRef.current]) {
            onSpinComplete(photos[finalIndexRef.current]);
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setOffset(0);
      setSpeed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, photos, onSpinComplete]);

  if (photos.length === 0) return null;

  // Get photos to display
  const getPhotoAtIndex = (idx) => {
    const normalizedIdx = ((idx % photos.length) + photos.length) % photos.length;
    return photos[normalizedIdx];
  };

  const displayPhoto = getPhotoAtIndex(currentIndex);
  const prevPhoto = getPhotoAtIndex(currentIndex - 1);
  const nextPhoto = getPhotoAtIndex(currentIndex + 1);

  // Blur disabled on mobile (CSS filter is very expensive on mobile GPUs)
  const blurAmount = IS_MOBILE_UA ? 0 : Math.min(speed / 6, 6);
  
  // Normalized offset for opacity/effects (0 to 1)
  const normalizedOffset = offset / 300;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Scrolling reel container */}
      <div 
        className="relative"
        style={{ 
          transform: `translate3d(0, ${offset * 0.3}px, 0)`,
          filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
          willChange: isSpinning ? 'transform' : 'auto',
          transition: isSpinning ? 'none' : 'filter 0.3s ease-out',
        }}
      >
        {/* Previous photo (entering from top) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2"
          style={{ 
            top: '-260px',
            opacity: isSpinning ? 0.5 + normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
              src={prevPhoto?.src}
              alt=""
              loading="eager"
              decoding="async"
              className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
            />
          </div>
        </div>

        {/* Current photo (center) - Square with black border */}
        <div 
          className={`border-[3px] border-black rounded-sm shadow-xl overflow-hidden transform transition-transform duration-300 ${
            !isSpinning ? 'scale-100' : 'scale-95'
          }`} 
          style={{ width: '250px', height: '250px' }}
        >
          <img
            src={displayPhoto?.src}
            alt=""
            loading="eager"
            decoding="async"
            className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
          />
        </div>

        {/* Next photo (exiting to bottom) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2"
          style={{ 
            bottom: '-260px',
            opacity: isSpinning ? 0.5 - normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
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
