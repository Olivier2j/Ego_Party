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
  const [isCelebrating, setIsCelebrating] = useState(false);
  
  const audioRefs = useRef({});
  const celebrationTimerRef = useRef(null);

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

    // Stop any ongoing celebration
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      setIsCelebrating(false);
    }

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
    
    // Start celebration (title blinking) for 2.5 seconds
    setIsCelebrating(true);
    celebrationTimerRef.current = setTimeout(() => {
      setIsCelebrating(false);
    }, 2500);
  }, [stopSound, playSound]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

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

      {/* Slot Machine Body with Lever */}
      <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">

        {/* Machine Frame with Bulbs */}
        <div className="relative bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-6 sm:p-8 shadow-machine border-4 border-amber-600 order-1">
          
          {/* Casino Title - Centered on machine */}
          <div className="text-center mb-4 relative z-10">
            <h1 className={`font-display text-4xl sm:text-5xl lg:text-6xl text-primary tracking-wider ${isCelebrating ? 'animate-title-blink' : 'neon-text-gold'}`}>
              EGO PARTY
            </h1>
            <p className="font-display text-lg sm:text-xl text-fuchsia-400 mt-1 tracking-widest" style={{ textShadow: '0 0 8px hsl(330 100% 60%), 0 0 15px hsl(330 100% 55%)' }}>
              SLOT MACHINE
            </p>
          </div>

          {/* Top Bulbs */}
          <CasinoBulbs position="top" count={9} isSpinning={isSpinning} />
          
          {/* Chrome Top Plate */}
          <div className="chrome-effect h-6 rounded-t-xl mb-4 border-b-2 border-gray-600" />

          {/* Slot Window */}
          <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-xl p-1 shadow-inner-slot border-4 border-gray-700">
            {/* Glass Reflection */}
            <div className="absolute inset-0 slot-glass rounded-xl pointer-events-none z-10" />
            
            {/* Polaroid Reel - fills the space */}
            <div className="relative overflow-hidden rounded-lg bg-black flex items-center justify-center" style={{ width: '270px', height: '330px' }}>
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
          <CasinoBulbs position="bottom" count={9} isSpinning={isSpinning} />

          {/* Side Bulbs */}
          <CasinoBulbs position="left" count={7} isSpinning={isSpinning} />
          <CasinoBulbs position="right" count={7} isSpinning={isSpinning} />
        </div>

        {/* Lever on the RIGHT (desktop) / BOTTOM (mobile) - Clickable */}
        <div 
          className={`relative cursor-pointer select-none transition-transform hover:scale-110 order-2 ${
            !canSpin ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleSpin}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleSpin()}
          aria-label="Tirer le levier pour tourner"
        >
          {/* Simple Red Button */}
          <div className="relative">
            {/* Button animated on press */}
            <div
              className={`transition-transform duration-500 ${
                leverPulled 
                  ? 'translate-y-4 scale-90' 
                  : 'translate-y-0 scale-100'
              }`}
            >
              {/* Red Button */}
              <div 
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-xl border-4 transition-all duration-300 relative ${
                  canSpin 
                    ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-300 hover:from-red-300 hover:via-red-400 hover:to-red-600 hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]' 
                    : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 border-gray-400'
                }`}
                style={{
                  boxShadow: canSpin 
                    ? '0 8px 20px rgba(0,0,0,0.4), inset 0 -4px 10px rgba(0,0,0,0.3), 0 0 15px rgba(239,68,68,0.3)' 
                    : '0 8px 20px rgba(0,0,0,0.4), inset 0 -4px 10px rgba(0,0,0,0.3)'
                }}
              >
                {/* Shine effect on button */}
                <div className="absolute top-2 left-3 w-6 h-6 bg-white/40 rounded-full blur-sm" />
                <div className="absolute top-4 left-5 w-2 h-2 bg-white/60 rounded-full" />
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
