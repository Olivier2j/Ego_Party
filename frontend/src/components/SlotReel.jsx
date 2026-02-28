import React, { useState, useEffect, useRef } from 'react';

export default function SlotReel({ photos, isSpinning, onSpinComplete, onPhotoChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [speed, setSpeed] = useState(0);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const totalSpinTimeRef = useRef(3000);
  const finalIndexRef = useRef(0);

  useEffect(() => {
    if (isSpinning && photos.length > 0) {
      startTimeRef.current = Date.now();
      totalSpinTimeRef.current = 2000 + Math.random() * 500; // 2-2.5 seconds for 15 clicks
      
      const initialSpeed = 80; // Adjusted speed for 15 clicks
      const photoHeight = 300; // Height of one photo slot
      
      // Target exactly 15 photo changes (clicks)
      // Random final photo selection
      const targetClicks = 15;
      const randomFinalIndex = Math.floor(Math.random() * photos.length);
      let accumulatedDistance = randomFinalIndex * photoHeight;
      
      let localIndex = randomFinalIndex;
      let clickCount = 0;
      setCurrentIndex(localIndex);
      finalIndexRef.current = localIndex;
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / totalSpinTimeRef.current, 1);
        
        // Custom easing: very fast at start, then progressively slower with a nice deceleration curve
        // Using a combination of easing functions for slot machine feel
        let easedProgress;
        if (progress < 0.3) {
          // First 30%: stay fast (slight ease)
          easedProgress = progress * 0.5;
        } else if (progress < 0.7) {
          // Middle 40%: gradual slowdown
          const midProgress = (progress - 0.3) / 0.4;
          easedProgress = 0.15 + midProgress * 0.45;
        } else {
          // Last 30%: strong deceleration to stop
          const endProgress = (progress - 0.7) / 0.3;
          const easeOutQuint = 1 - Math.pow(1 - endProgress, 5);
          easedProgress = 0.6 + easeOutQuint * 0.4;
        }
        
        // Speed decreases based on eased progress
        const currentSpeed = initialSpeed * (1 - easedProgress);
        setSpeed(currentSpeed);
        
        if (progress < 1) {
          accumulatedDistance += currentSpeed;
          
          // Calculate current offset within one photo height
          const newOffset = accumulatedDistance % photoHeight;
          setOffset(newOffset);
          
          // Update photo index when we pass a threshold
          const newIndex = Math.floor(accumulatedDistance / photoHeight);
          if (newIndex !== localIndex) {
            localIndex = newIndex;
            clickCount++;
            const photoIndex = localIndex % photos.length;
            setCurrentIndex(photoIndex);
            finalIndexRef.current = photoIndex;
            
            // Play click sound on each photo change (max 15 clicks)
            if (onPhotoChange && clickCount <= targetClicks) {
              onPhotoChange();
            }
          }
          
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - snap to final position
          setOffset(0);
          setSpeed(0);
          
          // Notify parent of the final selected photo
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

  // Calculate blur based on speed (more blur when faster)
  const blurAmount = Math.min(speed / 6, 6);
  
  // Normalize offset for smooth animation (0 to 1)
  const normalizedOffset = offset / 300;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Scrolling reel container */}
      <div 
        className="relative"
        style={{ 
          transform: `translateY(${offset * 0.3}px)`,
          filter: `blur(${blurAmount}px)`,
          transition: isSpinning ? 'none' : 'filter 0.3s ease-out',
        }}
      >
        {/* Previous photo (entering from top) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 transition-opacity"
          style={{ 
            top: '-260px',
            opacity: isSpinning ? 0.5 + normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg" style={{ width: '240px', height: '240px' }}>
            <img
              src={prevPhoto?.src}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Current photo (center) - Square with black border */}
        <div 
          className={`border-[3px] border-black rounded-sm shadow-xl transform transition-transform duration-300 ${
            !isSpinning ? 'scale-100' : 'scale-95'
          }`} 
          style={{ width: '250px', height: '250px' }}
        >
          <img
            src={displayPhoto?.src}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Next photo (exiting to bottom) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 transition-opacity"
          style={{ 
            bottom: '-260px',
            opacity: isSpinning ? 0.5 - normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg" style={{ width: '240px', height: '240px' }}>
            <img
              src={nextPhoto?.src}
              alt=""
              className="w-full h-full object-cover"
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
