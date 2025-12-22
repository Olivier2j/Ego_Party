import React, { useState, useEffect, useRef } from 'react';

export default function SlotReel({ photos, isSpinning, selectedPhoto }) {
  const [visiblePhotos, setVisiblePhotos] = useState([]);
  const [offset, setOffset] = useState(0);
  const animationRef = useRef(null);
  const speedRef = useRef(0);
  const startTimeRef = useRef(0);
  const totalSpinTimeRef = useRef(3000);

  // Initialize visible photos
  useEffect(() => {
    if (photos.length > 0) {
      // Create a list of photos to display (current + surrounding)
      updateVisiblePhotos(0);
    }
  }, [photos]);

  const updateVisiblePhotos = (index) => {
    if (photos.length === 0) return;
    
    const idx = ((index % photos.length) + photos.length) % photos.length;
    const prevIdx = ((idx - 1) % photos.length + photos.length) % photos.length;
    const nextIdx = (idx + 1) % photos.length;
    
    setVisiblePhotos([
      photos[prevIdx],
      photos[idx],
      photos[nextIdx],
    ]);
  };

  useEffect(() => {
    if (isSpinning && photos.length > 0) {
      startTimeRef.current = Date.now();
      totalSpinTimeRef.current = 2500 + Math.random() * 1500; // 2.5-4 seconds
      speedRef.current = 40; // Initial very fast speed (pixels per frame)
      
      let currentIndex = 0;
      let accumulatedOffset = 0;
      const photoHeight = 280; // Height of one photo slot
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / totalSpinTimeRef.current, 1);
        
        // Easing function: start fast, slow down exponentially
        // Using cubic easing out for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        // Speed decreases from 40 to near 0
        const currentSpeed = speedRef.current * (1 - easeOut);
        
        if (progress < 1) {
          accumulatedOffset += Math.max(currentSpeed, 0.5);
          
          // When we've scrolled past one photo height, move to next photo
          if (accumulatedOffset >= photoHeight) {
            accumulatedOffset -= photoHeight;
            currentIndex++;
            updateVisiblePhotos(currentIndex);
          }
          
          setOffset(accumulatedOffset);
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - snap to final position
          setOffset(0);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      // Reset when not spinning
      setOffset(0);
      if (selectedPhoto) {
        const idx = photos.findIndex(p => p.id === selectedPhoto.id);
        if (idx !== -1) {
          updateVisiblePhotos(idx);
        }
      }
    }
  }, [isSpinning, photos, selectedPhoto]);

  // Update display when selected photo changes (after spin stops)
  useEffect(() => {
    if (!isSpinning && selectedPhoto && photos.length > 0) {
      const idx = photos.findIndex(p => p.id === selectedPhoto.id);
      if (idx !== -1) {
        updateVisiblePhotos(idx);
      }
    }
  }, [selectedPhoto, isSpinning, photos]);

  if (photos.length === 0 || visiblePhotos.length === 0) return null;

  const currentPhoto = !isSpinning && selectedPhoto ? selectedPhoto : visiblePhotos[1];

  // Calculate blur based on speed
  const blurAmount = isSpinning ? Math.min(offset / 30, 8) : 0;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Scrolling container */}
      <div 
        className="relative transition-[filter] duration-100"
        style={{ 
          transform: `translateY(${offset}px)`,
          filter: `blur(${blurAmount}px)`,
        }}
      >
        {/* Previous photo (top, moving down) */}
        {isSpinning && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 opacity-40"
            style={{ top: '-260px' }}
          >
            <div className="polaroid-frame transform scale-75">
              <div className="w-44 sm:w-52 aspect-[3/4] overflow-hidden rounded-sm bg-gray-200">
                <img
                  src={visiblePhotos[0]?.src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="h-6" />
            </div>
          </div>
        )}

        {/* Current photo (center) */}
        <div className={`polaroid-frame transform transition-transform duration-300 ${
          !isSpinning && selectedPhoto ? 'scale-100' : 'scale-95'
        }`}>
          <div className="w-48 sm:w-56 aspect-[3/4] overflow-hidden rounded-sm bg-gray-200">
            <img
              src={currentPhoto?.src}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="h-8" />
        </div>

        {/* Next photo (bottom, entering from below) */}
        {isSpinning && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 opacity-40"
            style={{ bottom: '-260px' }}
          >
            <div className="polaroid-frame transform scale-75">
              <div className="w-44 sm:w-52 aspect-[3/4] overflow-hidden rounded-sm bg-gray-200">
                <img
                  src={visiblePhotos[2]?.src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="h-6" />
            </div>
          </div>
        )}
      </div>

      {/* Top shadow for depth effect */}
      {isSpinning && (
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
      )}
      
      {/* Bottom shadow for depth effect */}
      {isSpinning && (
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />
      )}
    </div>
  );
}
