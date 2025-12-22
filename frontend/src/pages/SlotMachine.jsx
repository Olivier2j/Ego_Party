import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import SlotReel from '../components/SlotReel';
import CasinoBulbs from '../components/CasinoBulbs';

// Sound URLs - Wheel spinning sound like "The Price is Right"
const SOUNDS = {
  spin: 'https://assets.mixkit.co/active_storage/sfx/146/146-preview.mp3', // Wheel spinning/clicking sound
  stop: 'https://assets.mixkit.co/active_storage/sfx/220/220-preview.mp3', // Soft bell ding
  lever: 'https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3', // Click sound
};

export default function SlotMachine() {
  const [photos, setPhotos] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [leverPulled, setLeverPulled] = useState(false);
  
  const audioRefs = useRef({});

  // Load photos from localStorage
  useEffect(() => {
    const savedPhotos = localStorage.getItem('slotPhotos');
    if (savedPhotos) {
      const parsed = JSON.parse(savedPhotos);
      // Use functional update to avoid lint warning
      setPhotos(() => parsed);
    }
  }, []);

  // Preload sounds
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioRefs.current[key] = audio;
    });
  }, []);

  const playSound = useCallback((soundName) => {
    if (soundEnabled && audioRefs.current[soundName]) {
      const audio = audioRefs.current[soundName];
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }, [soundEnabled]);

  const stopSound = useCallback((soundName) => {
    if (audioRefs.current[soundName]) {
      audioRefs.current[soundName].pause();
      audioRefs.current[soundName].currentTime = 0;
    }
  }, []);

  const handleSpin = useCallback(() => {
    if (isSpinning || photos.length === 0) return;

    setLeverPulled(true);
    setSelectedPhoto(null);
    playSound('lever');

    setTimeout(() => {
      setLeverPulled(false);
      setIsSpinning(true);
      playSound('spin');
    }, 500);
  }, [isSpinning, photos.length, playSound]);

  // Called by SlotReel when animation completes
  const handleSpinComplete = useCallback((photo) => {
    stopSound('spin');
    playSound('stop');
    setIsSpinning(false);
    setSelectedPhoto(photo);
  }, [stopSound, playSound]);

  const canSpin = photos.length > 0 && !isSpinning;

  return (
    <div className="min-h-screen velvet-texture flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-pink/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-primary hover:text-primary/80"
        >
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        <Link to="/manage">
          <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Casino Title */}
      <div className="text-center mb-8 relative z-10">
        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl text-primary neon-text-gold tracking-wider">
          LUCKY PHOTO
        </h1>
        <p className="font-display text-2xl sm:text-3xl text-neon-pink neon-text-pink mt-2 animate-neon-pulse">
          SLOT MACHINE
        </p>
      </div>

      {/* Slot Machine Body with Lever */}
      <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">

        {/* Machine Frame with Bulbs */}
        <div className="relative bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-6 sm:p-8 shadow-machine border-4 border-amber-600 order-1">
          {/* Top Bulbs */}
          <CasinoBulbs position="top" count={9} />
          
          {/* Chrome Top Plate */}
          <div className="chrome-effect h-6 rounded-t-xl mb-4 border-b-2 border-gray-600" />

          {/* Slot Window */}
          <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-xl p-4 shadow-inner-slot border-4 border-gray-700">
            {/* Glass Reflection */}
            <div className="absolute inset-0 slot-glass rounded-xl pointer-events-none z-10" />
            
            {/* Polaroid Reel */}
            <div className="relative w-64 sm:w-80 h-80 sm:h-96 overflow-hidden rounded-lg bg-black">
              {photos.length > 0 ? (
                <SlotReel
                  photos={photos}
                  isSpinning={isSpinning}
                  onSpinComplete={handleSpinComplete}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-6">
                    <p className="text-muted-foreground font-display text-xl mb-4">
                      AUCUNE PHOTO
                    </p>
                    <Link to="/manage">
                      <Button variant="casino" size="lg">
                        AJOUTER DES PHOTOS
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chrome Bottom Plate */}
          <div className="chrome-effect h-4 rounded-b-xl mt-4 border-t-2 border-gray-400" />

          {/* Bottom Bulbs */}
          <CasinoBulbs position="bottom" count={9} />

          {/* Side Bulbs */}
          <CasinoBulbs position="left" count={7} />
          <CasinoBulbs position="right" count={7} />
        </div>

        {/* Lever on the RIGHT (desktop) / BOTTOM (mobile) - Clickable */}
        <div 
          className={`relative cursor-pointer select-none transition-transform hover:scale-105 order-2 ${
            !canSpin ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleSpin}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleSpin()}
          aria-label="Tirer le levier pour tourner"
        >
          {/* Desktop: Vertical lever with ball on TOP, Mobile: Horizontal lever */}
          <div className="relative">
            {/* Lever Base/Mount */}
            <div className="relative">
              {/* Base plate */}
              <div className="w-32 h-14 sm:w-14 sm:h-44 chrome-effect rounded-lg border-2 border-gray-500 shadow-lg" />
              
              {/* Lever mechanism slot */}
              <div className="absolute top-1/2 -translate-y-1/2 left-4 sm:left-1/2 sm:-translate-x-1/2 sm:top-6 sm:translate-y-0 w-20 h-6 sm:w-6 sm:h-32 bg-gray-800 rounded-full border border-gray-600" />
              
              {/* Lever Arm - Ball on TOP for desktop, animated downward */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 left-2 sm:left-1/2 sm:-translate-x-1/2 sm:top-4 sm:translate-y-0 transition-transform duration-500 ${
                  leverPulled 
                    ? 'translate-x-16 sm:translate-x-0 sm:translate-y-20' 
                    : 'translate-x-0 sm:translate-x-0 sm:translate-y-0'
                }`}
              >
                {/* Lever Ball/Handle - ON TOP for desktop */}
                <div 
                  className={`hidden sm:block w-14 h-14 -ml-[22px] -mt-1 rounded-full shadow-xl border-4 transition-all duration-300 relative ${
                    canSpin 
                      ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-300 hover:from-red-300 hover:via-red-400 hover:to-red-600' 
                      : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 border-gray-400'
                  }`}
                >
                  {/* Shine effect on ball */}
                  <div className="absolute top-2 left-2 w-4 h-4 bg-white/40 rounded-full blur-sm" />
                </div>
                
                {/* Arm shaft - vertical on desktop, horizontal on mobile */}
                <div className="w-20 h-3 sm:w-3 sm:h-28 chrome-effect rounded-full border border-gray-400 shadow-md sm:ml-0 sm:-mt-1" />
                
                {/* Mobile Ball - on right side */}
                <div 
                  className={`sm:hidden absolute -right-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full shadow-xl border-4 transition-all duration-300 ${
                    canSpin 
                      ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-300' 
                      : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 border-gray-400'
                  }`}
                >
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 bg-white/40 rounded-full blur-sm" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Label under lever */}
          <p className={`font-display text-sm mt-3 text-center transition-colors ${
            canSpin ? 'text-primary' : 'text-muted-foreground'
          }`}>
            {isSpinning ? 'ATTENDRE...' : 'TIRER'}
          </p>
        </div>
      </div>

      {/* Photo Count */}
      <div className="mt-6 text-center">
        <p className="text-muted-foreground font-display text-lg">
          {photos.length} PHOTO{photos.length !== 1 ? 'S' : ''} DANS LA MACHINE
        </p>
      </div>
    </div>
  );
}
