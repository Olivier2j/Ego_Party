import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function SlotReel({ photos, isSpinning, selectedPhoto }) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [blurAmount, setBlurAmount] = useState(0);
  const intervalRef = useRef(null);
  const speedRef = useRef(50);

  // Shuffle photos for spinning effect
  const shuffledPhotos = useMemo(() => {
    if (photos.length < 3) return [...photos, ...photos, ...photos];
    return [...photos].sort(() => Math.random() - 0.5);
  }, [photos]);

  useEffect(() => {
    if (isSpinning) {
      speedRef.current = 50;
      setBlurAmount(8);

      intervalRef.current = setInterval(() => {
        setDisplayIndex((prev) => (prev + 1) % shuffledPhotos.length);
      }, speedRef.current);

      // Gradually slow down
      const slowDownInterval = setInterval(() => {
        speedRef.current += 20;
        setBlurAmount((prev) => Math.max(0, prev - 0.5));

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            setDisplayIndex((prev) => (prev + 1) % shuffledPhotos.length);
          }, speedRef.current);
        }
      }, 200);

      return () => {
        clearInterval(slowDownInterval);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setBlurAmount(0);
    }
  }, [isSpinning, shuffledPhotos.length]);

  // When spinning stops, show selected photo
  useEffect(() => {
    if (!isSpinning && selectedPhoto) {
      const index = shuffledPhotos.findIndex((p) => p.id === selectedPhoto.id);
      if (index !== -1) {
        setDisplayIndex(index);
      }
    }
  }, [isSpinning, selectedPhoto, shuffledPhotos]);

  const currentPhoto = selectedPhoto && !isSpinning ? selectedPhoto : shuffledPhotos[displayIndex];
  const prevPhoto = shuffledPhotos[(displayIndex - 1 + shuffledPhotos.length) % shuffledPhotos.length];
  const nextPhoto = shuffledPhotos[(displayIndex + 1) % shuffledPhotos.length];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Reel container with vertical scroll effect */}
      <div
        className="relative transition-all duration-100"
        style={{ filter: `blur(${blurAmount}px)` }}
      >
        {/* Previous photo (above, faded) */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-56 opacity-30 transition-opacity ${
            isSpinning ? 'opacity-20' : 'opacity-30'
          }`}
        >
          <div className="polaroid-frame transform scale-75">
            <div className="aspect-[3/4] overflow-hidden rounded-sm">
              <img
                src={prevPhoto?.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Current photo (center, main) */}
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

        {/* Next photo (below, faded) */}
        <div
          className={`absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-56 opacity-30 transition-opacity ${
            isSpinning ? 'opacity-20' : 'opacity-30'
          }`}
        >
          <div className="polaroid-frame transform scale-75">
            <div className="aspect-[3/4] overflow-hidden rounded-sm">
              <img
                src={nextPhoto?.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spinning overlay effect */}
      {isSpinning && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />
      )}
    </div>
  );
}
