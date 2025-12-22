import React, { useState, useEffect, useRef } from 'react';

export default function SlotReel({ photos, isSpinning, onSpinComplete }) {
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
      totalSpinTimeRef.current = 2500 + Math.random() * 1500; // 2.5-4 seconds
      
      const initialSpeed = 50; // Very fast initial speed
      const photoHeight = 300; // Height of one photo slot
      let accumulatedDistance = 0;
      let localIndex = currentIndex; // Start from current position
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / totalSpinTimeRef.current, 1);
        
        // Easing: very fast at start, progressively slower
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        // Speed decreases from initialSpeed to 0
        const currentSpeed = initialSpeed * (1 - easeOutQuart);
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
            const photoIndex = localIndex % photos.length;
            setCurrentIndex(photoIndex);
            finalIndexRef.current = photoIndex;
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
            top: '-280px',
            opacity: isSpinning ? 0.5 + normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="polaroid-frame transform scale-[0.75] flex flex-col" style={{ width: '250px', aspectRatio: '1/1.21' }}>
            <div className="flex-1 overflow-hidden rounded-sm bg-gray-200">
              <img
                src={prevPhoto?.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Current photo (center) */}
        <div className={`polaroid-frame transform transition-transform duration-300 flex flex-col ${
          !isSpinning ? 'scale-100' : 'scale-95'
        }`} style={{ width: '250px', aspectRatio: '1/1.21' }}>
          <div className="flex-1 overflow-hidden rounded-sm bg-gray-200">
            <img
              src={displayPhoto?.src}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Next photo (exiting to bottom) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 transition-opacity"
          style={{ 
            bottom: '-280px',
            opacity: isSpinning ? 0.5 - normalizedOffset * 0.3 : 0,
          }}
        >
          <div className="polaroid-frame transform scale-[0.75] flex flex-col" style={{ width: '250px', aspectRatio: '1/1.21' }}>
            <div className="flex-1 overflow-hidden rounded-sm bg-gray-200">
              <img
                src={nextPhoto?.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
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
