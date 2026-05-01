import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import SlotReel from '../components/SlotReel';
import CasinoBulbs from '../components/CasinoBulbs';
import usePWAMode from '../hooks/usePWAMode';
import builtinPhotos from '../assets/photos/builtin';

// Sound URLs - Wheel spinning sound like "The Price is Right"
const SOUNDS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Single click/tick sound
  stop: 'https://assets.mixkit.co/active_storage/sfx/220/220-preview.mp3', // Soft bell ding
  lever: 'https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3', // Lever click sound
};

export default function SlotMachine() {
  const [photos, setPhotos] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [leverPulled, setLeverPulled] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isPWA = usePWAMode();
  const [usingBuiltin, setUsingBuiltin] = useState(false);

  const audioRefs = useRef({});
  const clickAudioPoolRef = useRef([]); // Pool of audio elements for rapid clicks
  const clickPoolIndexRef = useRef(0);
  const celebrationTimerRef = useRef(null);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load photos — built-in bundle when PWA OR when localStorage is empty;
  // otherwise the user's uploaded photos from localStorage.
  useEffect(() => {
    if (isPWA) {
      setPhotos(builtinPhotos);
      setUsingBuiltin(true);
      return;
    }
    const savedPhotos = localStorage.getItem('slotPhotos');
    if (savedPhotos) {
      try {
        const parsed = JSON.parse(savedPhotos);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPhotos(() => parsed);
          setUsingBuiltin(false);
          return;
        }
      } catch {
        /* fall through to builtin */
      }
    }
    // Empty / unreadable localStorage → use builtin photos as default
    setPhotos(builtinPhotos);
    setUsingBuiltin(true);
  }, [isPWA]);

  // Preload photos in the background — but only a small sample (adjacent pages)
  // to avoid pinning ~100 MB of decoded JPEGs in RAM on mobile. The Service
  // Worker + browser cache handle the rest on-demand.
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const sample = photos.slice(0, Math.min(20, photos.length));
    sample.forEach((p) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = p.src;
    });
  }, [photos]);

  // Preload sounds
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.15; // 15% of max
      audioRefs.current[key] = audio;
    });
    
    // Create a pool of click sounds for rapid playback
    for (let i = 0; i < 8; i++) {
      const clickAudio = new Audio(SOUNDS.click);
      clickAudio.preload = 'auto';
      clickAudio.volume = 0.15; // 15% of max
      clickAudioPoolRef.current.push(clickAudio);
    }
  }, []);

  const playSound = useCallback((soundName) => {
    if (soundEnabled && audioRefs.current[soundName]) {
      const audio = audioRefs.current[soundName];
      // Stop sound at 10% volume (30% less than 15%)
      audio.volume = soundName === 'stop' ? 0.10 : 0.15;
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

  // Play click sound from pool (for rapid succession)
  const playClickSound = useCallback(() => {
    if (!soundEnabled) return;
    
    const pool = clickAudioPoolRef.current;
    if (pool.length > 0) {
      const audio = pool[clickPoolIndexRef.current];
      audio.volume = 0.15; // Force volume before playing
      audio.currentTime = 0;
      audio.play().catch(() => {});
      clickPoolIndexRef.current = (clickPoolIndexRef.current + 1) % pool.length;
    }
  }, [soundEnabled]);

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
      setIsSpinning(true);
      // Keep leverPulled true - it will be reset when spin completes
    }, 300);
  }, [isSpinning, photos.length, playSound]);

  // Called by SlotReel when animation completes
  const handleSpinComplete = useCallback((photo) => {
    playSound('stop');
    setIsSpinning(false);
    setSelectedPhoto(photo);
    
    // Slowly return the lever
    setLeverPulled(false);
    
    // Start celebration — blinking stops when the "stop" sound ends naturally
    setIsCelebrating(true);
    const stopAudio = audioRefs.current.stop;
    if (stopAudio) {
      const onEnded = () => {
        setIsCelebrating(false);
        stopAudio.removeEventListener('ended', onEnded);
      };
      stopAudio.addEventListener('ended', onEnded);
      // Safety fallback in case 'ended' doesn't fire (e.g. tab suspended)
      celebrationTimerRef.current = setTimeout(() => {
        setIsCelebrating(false);
        stopAudio.removeEventListener('ended', onEnded);
      }, 2500);
    } else {
      celebrationTimerRef.current = setTimeout(() => {
        setIsCelebrating(false);
      }, 1250);
    }
  }, [playSound]);

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
        {!isPWA && (
          <Link to="/manage" data-testid="open-photo-manager-btn">
            <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        )}
      </div>

      {/* Slot Machine Body with Lever INSIDE the frame */}
      <div className="relative">

        {/* Machine Frame with Bulbs - GREEN body with GOLD border - includes lever */}
        <div className="relative rounded-3xl p-6 sm:p-8 shadow-machine border-4" style={{ background: 'linear-gradient(180deg, hsl(150 30% 25%) 0%, hsl(150 35% 18%) 50%, hsl(150 30% 22%) 100%)', borderColor: 'hsl(35 48% 45%)' }}>
          
          {/* Casino Title - Centered on machine */}
          <div className="text-center mb-4 relative z-10">
            <h1 className={`font-display text-4xl sm:text-5xl lg:text-6xl tracking-wider ${isCelebrating ? 'animate-title-blink' : 'neon-text-gold'}`} style={{ color: 'hsl(37 69% 69%)' }}>
              EGO PARTY
            </h1>
            <p className="font-display text-lg sm:text-xl mt-1 tracking-widest" style={{ color: 'hsl(35 48% 53%)', textShadow: '0 0 5px hsl(35 48% 53%), 0 0 10px hsl(35 40% 45%)' }}>
              SLOT MACHINE
            </p>
          </div>

          {/* Top Bulbs */}
          <CasinoBulbs position="top" count={11} isSpinning={isSpinning} />
          
          {/* Main content area: Slot + Lever side by side on desktop, stacked on mobile */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            
            {/* Slot Section */}
            <div className="flex flex-col">
              {/* Gold Top Plate */}
              <div className="h-6 rounded-t-xl mb-4 border-b-2" style={{ background: 'linear-gradient(180deg, hsl(35 48% 55%) 0%, hsl(35 48% 45%) 100%)', borderColor: 'hsl(35 40% 35%)' }} />

              {/* Slot Window - with gold border */}
              <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-xl p-1 shadow-inner-slot border-4" style={{ borderColor: 'hsl(35 48% 40%)' }}>
                {/* Glass Reflection */}
                <div className="absolute inset-0 slot-glass rounded-xl pointer-events-none z-10" />
                
                {/* Polaroid Reel - Square format */}
                <div className="relative overflow-hidden rounded-lg bg-black flex items-center justify-center" style={{ width: '280px', height: '280px' }}>
                  {photos.length > 0 ? (
                    <SlotReel
                      photos={photos}
                      isSpinning={isSpinning}
                      onSpinComplete={handleSpinComplete}
                      onPhotoChange={playClickSound}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-6">
                        <p className="text-muted-foreground font-display text-xl mb-4">
                          AUCUNE PHOTO
                        </p>
                        {!isPWA && (
                          <Link to="/manage">
                            <Button variant="casino" size="lg">
                              AJOUTER DES PHOTOS
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Gold Bottom Plate - same height as top (h-6) */}
              <div className="h-6 rounded-b-xl mt-4 border-t-2" style={{ background: 'linear-gradient(180deg, hsl(35 48% 45%) 0%, hsl(35 48% 55%) 100%)', borderColor: 'hsl(35 40% 55%)' }} />
            </div>

            {/* Lever Section - INSIDE the frame */}
            <div 
              className={`relative cursor-pointer select-none transition-transform hover:scale-105 ${
                !canSpin ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleSpin}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSpin()}
              aria-label="Tirer le levier pour tourner"
            >
              {/* Lever with frame and red button */}
              <div className="relative">
                {/* Fixed Frame/Mount - GREEN to match machine body */}
                <div className="relative">
                  {/* Base plate - wider horizontal on mobile, vertical on desktop */}
                  <div className="w-44 h-14 sm:w-16 sm:h-36 rounded-xl border-4 shadow-lg" style={{ background: 'linear-gradient(180deg, hsl(150 30% 20%) 0%, hsl(150 35% 14%) 50%, hsl(150 30% 18%) 100%)', borderColor: 'hsl(35 48% 45%)' }} />
                  
                  {/* Slot/track for the button - darker green groove */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:top-4 sm:translate-y-0 h-8 sm:w-10 sm:h-24 rounded-lg border-2 shadow-inner" style={{ background: 'hsl(150 35% 10%)', borderColor: 'hsl(150 30% 8%)' }} />
                  
                  {/* Red Button - Mobile: horizontal (left/right), Desktop: vertical (top/bottom) */}
                  <div
                    className="absolute"
                    style={isMobile ? {
                      // Mobile: horizontal movement
                      left: leverPulled ? '124px' : '16px',
                      top: '50%',
                      transform: `translateY(-50%) ${leverPulled ? 'scale(0.95)' : 'scale(1)'}`,
                      transition: leverPulled 
                        ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease-out'
                        : 'left 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.8s ease-in-out',
                    } : {
                      // Desktop: vertical movement
                      left: '50%',
                      top: leverPulled ? '88px' : '16px',
                      transform: `translateX(-50%) ${leverPulled ? 'scale(0.95)' : 'scale(1)'}`,
                      transition: leverPulled 
                        ? 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease-out'
                        : 'top 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.8s ease-in-out',
                    }}
                  >
                    {/* DARK RED/MAROON button #A51C30 - Always red */}
                    <div 
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-xl border-4 transition-all duration-300 relative ${
                        canSpin 
                          ? 'hover:shadow-[0_0_25px_rgba(165,28,48,0.6)]' 
                          : 'opacity-70'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #c42a3f 0%, #A51C30 50%, #8a1728 100%)',
                        borderColor: '#7a1525',
                        boxShadow: '0 6px 15px rgba(0,0,0,0.4), inset 0 -3px 8px rgba(0,0,0,0.3), 0 0 12px rgba(165,28,48,0.4)'
                      }}
                    >
                      {/* Shine effect on button */}
                      <div className="absolute top-1 left-1.5 w-3 h-3 bg-white/40 rounded-full blur-sm" />
                      <div className="absolute top-2 left-3 w-1 h-1 bg-white/60 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bulbs */}
          <CasinoBulbs position="bottom" count={11} isSpinning={isSpinning} />

          {/* Side Bulbs */}
          <CasinoBulbs position="left" count={7} isSpinning={isSpinning} />
          <CasinoBulbs position="right" count={7} isSpinning={isSpinning} />
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
