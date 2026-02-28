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
      totalSpinTimeRef.current = 2200; // Fixed duration for consistent feel
      
      const photoHeight = 300; // Height of one photo slot
      
      // RANDOM: Select the final photo index randomly
      const randomFinalIndex = Math.floor(Math.random() * photos.length);
      finalIndexRef.current = randomFinalIndex;
      
      // Scroll through exactly ~15 photos total, ending on randomFinalIndex
      const totalClicks = 15;
      const totalDistance = totalClicks * photoHeight;
      
      // Calculate starting index to land on randomFinalIndex after totalClicks
      const startIndex = ((randomFinalIndex - totalClicks) % photos.length + photos.length) % photos.length;
      
      let lastIndex = startIndex;
      setCurrentIndex(startIndex);
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / totalSpinTimeRef.current, 1);
        
        // Custom easing: fast start, slow end
        let easedProgress;
        if (progress < 0.3) {
          // First 30%: fast
          easedProgress = progress * 0.6;
        } else if (progress < 0.7) {
          // Middle 40%: gradual slowdown
          const midProgress = (progress - 0.3) / 0.4;
          easedProgress = 0.18 + midProgress * 0.42;
        } else {
          // Last 30%: strong deceleration
          const endProgress = (progress - 0.7) / 0.3;
          const easeOutQuart = 1 - Math.pow(1 - endProgress, 4);
          easedProgress = 0.6 + easeOutQuart * 0.4;
        }
        
        // Calculate current position based on eased progress
        const currentDistance = totalDistance * easedProgress;
        const currentOffset = currentDistance % photoHeight;
        const clicksCompleted = Math.floor(currentDistance / photoHeight);
        const currentPhotoIndex = (startIndex + clicksCompleted) % photos.length;
        
        // Update speed for blur effect
        const speed = progress < 1 ? (1 - easedProgress) * 80 : 0;
        setSpeed(speed);
        setOffset(currentOffset);
        
        // Play click sound when photo changes
        if (currentPhotoIndex !== lastIndex) {
          lastIndex = currentPhotoIndex;
          setCurrentIndex(currentPhotoIndex);
          
          if (onPhotoChange) {
            onPhotoChange();
          }
        }
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - ensure clean final state
          setOffset(0);
          setSpeed(0);
          setCurrentIndex(randomFinalIndex);
          
          // Notify parent of the final selected photo
          if (onSpinComplete && photos[randomFinalIndex]) {
            onSpinComplete(photos[randomFinalIndex]);
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
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
              src={prevPhoto?.src}
              alt=""
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
            className="w-[102%] h-[102%] object-cover -ml-[1%] -mt-[1%]"
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
          <div className="transform scale-[0.75] border-[3px] border-black rounded-sm shadow-lg overflow-hidden" style={{ width: '240px', height: '240px' }}>
            <img
              src={nextPhoto?.src}
              alt=""
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
