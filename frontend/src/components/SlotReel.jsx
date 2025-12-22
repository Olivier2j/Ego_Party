import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function SlotReel({ photos, isSpinning, selectedPhoto }) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [blurAmount, setBlurAmount] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const intervalRef = useRef(null);
  const animationRef = useRef(null);
  const speedRef = useRef(15);

  // Create extended photo list for smooth scrolling
  const extendedPhotos = useMemo(() => {
    if (photos.length === 0) return [];
    // Triple the photos for seamless looping
    return [...photos, ...photos, ...photos];
  }, [photos]);

  useEffect(() => {
    if (isSpinning && photos.length > 0) {
      speedRef.current = 15; // Fast initial speed
      setBlurAmount(6);
      
      let currentOffset = 0;
      const photoHeight = 320; // Approximate height of polaroid
      const totalHeight = photos.length * photoHeight;
      
      // Animation loop for smooth scrolling top to bottom
      const animate = () => {
        currentOffset += speedRef.current;
        
        // Reset offset when we've scrolled through one set
        if (currentOffset >= totalHeight) {
          currentOffset = currentOffset % totalHeight;
        }
        
        setOffsetY(currentOffset);
        setDisplayIndex(Math.floor(currentOffset / photoHeight) % photos.length);
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);

      // Gradually slow down
      intervalRef.current = setInterval(() => {
        speedRef.current = Math.max(speedRef.current * 0.95, 0);
        setBlurAmount((prev) => Math.max(0, prev - 0.3));
      }, 100);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // When not spinning, reset
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setBlurAmount(0);
      setOffsetY(0);
    }
  }, [isSpinning, photos.length]);

  // Get current photo to display
  const currentPhoto = selectedPhoto && !isSpinning ? selectedPhoto : photos[displayIndex] || photos[0];

  if (photos.length === 0) return null;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Single polaroid display */}
      <div
        className="relative transition-all duration-150"
        style={{ 
          filter: `blur(${blurAmount}px)`,
          transform: isSpinning ? `translateY(${(offsetY % 20) - 10}px)` : 'translateY(0)'
        }}
      >
        {/* Main photo in polaroid frame */}
        <div
          className={`polaroid-frame transform transition-transform duration-300 ${
            !isSpinning && selectedPhoto ? 'scale-100' : 'scale-95'
          }`}
        >
          <div className="w-48 sm:w-56 aspect-[3/4] overflow-hidden rounded-sm bg-gray-200">
            <img
              src={currentPhoto?.src}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          {/* Polaroid bottom area */}
          <div className="h-8" />
        </div>
      </div>

      {/* Spinning overlay effect - motion blur from top */}
      {isSpinning && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/30 pointer-events-none" />
      )}
    </div>
  );
}
