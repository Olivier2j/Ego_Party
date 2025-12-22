import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { X, Download, Sparkles } from 'lucide-react';

export default function WinDisplay({ photo, onClose }) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.src;
    link.download = photo.name || 'lucky-photo.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: ['#FFD700', '#FF69B4', '#00FFFF', '#FF0000'][
                  Math.floor(Math.random() * 4)
                ],
                animation: `confetti-fall ${2 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className="relative z-10 animate-bounce-win"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Win Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary animate-neon-pulse" />
            <h2 className="font-display text-5xl sm:text-6xl text-primary neon-text-gold">
              JACKPOT!
            </h2>
            <Sparkles className="h-8 w-8 text-primary animate-neon-pulse" />
          </div>
          <p className="font-display text-2xl text-neon-pink neon-text-pink">
            VOTRE PHOTO GAGNANTE
          </p>
        </div>

        {/* Photo Display */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-primary/30 rounded-lg blur-xl animate-pulse-glow" />
          
          {/* Polaroid frame */}
          <div className="relative polaroid-frame transform scale-110">
            <div className="w-64 sm:w-80 aspect-[3/4] overflow-hidden rounded-sm">
              <img
                src={photo.src}
                alt="Photo gagnante"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Polaroid bottom */}
            <div className="h-10" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-8">
          <Button
            variant="casino"
            size="lg"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-5 w-5" />
            TÉLÉCHARGER
          </Button>
          <Button
            variant="neon"
            size="lg"
            onClick={onClose}
            className="gap-2"
          >
            <X className="h-5 w-5" />
            FERMER
          </Button>
        </div>
      </div>
    </div>
  );
}
