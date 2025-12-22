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

      // Spin duration: 2-4 seconds
      const spinDuration = 2000 + Math.random() * 2000;

      setTimeout(() => {
        stopSound('spin');
        playSound('stop');
        setIsSpinning(false);

        // Select random photo
        const randomIndex = Math.floor(Math.random() * photos.length);
        setSelectedPhoto(photos[randomIndex]);
      }, spinDuration);
    }, 500);
  }, [isSpinning, photos, playSound, stopSound]);

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

      {/* Slot Machine Body */}
      <div className="relative">
        {/* Machine Frame with Bulbs */}
        <div className="relative bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-6 sm:p-8 shadow-machine border-4 border-amber-600">
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
                  selectedPhoto={selectedPhoto}
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

        {/* Lever */}
        <div className="absolute -right-16 sm:-right-20 top-1/2 -translate-y-1/2">
          <div className="relative">
            {/* Lever Base */}
            <div className="w-8 h-32 chrome-effect rounded-full border-2 border-gray-500" />
            
            {/* Lever Arm */}
            <div
              className={`absolute -top-12 left-1/2 -translate-x-1/2 transition-transform duration-500 origin-bottom ${
                leverPulled ? 'rotate-45' : 'rotate-0'
              }`}
            >
              <div className="w-4 h-24 chrome-effect rounded-full border border-gray-500" />
              {/* Lever Ball */}
              <div className="w-10 h-10 -mt-2 -ml-3 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 border-4 border-red-400 shadow-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Spin Button */}
      <div className="mt-8 relative z-10">
        <Button
          variant="casino"
          size="xl"
          onClick={handleSpin}
          disabled={isSpinning || photos.length === 0}
          className={`text-2xl px-12 py-6 h-auto ${
            isSpinning ? 'opacity-50' : 'animate-pulse-glow'
          }`}
        >
          {isSpinning ? 'EN COURS...' : 'TOURNER'}
        </Button>
      </div>

      {/* Photo Count */}
      <div className="mt-4 text-center">
        <p className="text-muted-foreground font-display text-lg">
          {photos.length} PHOTO{photos.length !== 1 ? 'S' : ''} DANS LA MACHINE
        </p>
      </div>

      {/* Win Display Overlay */}
      {showWin && selectedPhoto && (
        <WinDisplay photo={selectedPhoto} onClose={() => setShowWin(false)} />
      )}
    </div>
  );
}
