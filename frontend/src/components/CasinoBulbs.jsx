import React, { useMemo } from 'react';

const COLORS = [
  'text-neon-gold',
  'text-neon-pink',
  'text-neon-cyan',
  'text-neon-red',
];

export default function CasinoBulbs({ position, count = 7, isSpinning = false }) {
  const bulbs = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      delay: i * 0.1,
      blinkDelay: (i * 0.05) % 0.3, // Fast staggered blink
    }));
  }, [count]);

  const positionClasses = {
    top: 'absolute -top-3 left-0 right-0 flex justify-around px-8',
    bottom: 'absolute -bottom-3 left-0 right-0 flex justify-around px-8',
    left: 'absolute left-0 top-0 bottom-0 -translate-x-3 flex flex-col justify-around py-8',
    right: 'absolute right-0 top-0 bottom-0 translate-x-3 flex flex-col justify-around py-8',
  };

  return (
    <div className={positionClasses[position]}>
      {bulbs.map((bulb) => (
        <div
          key={bulb.id}
          className={`casino-bulb ${bulb.color} ${isSpinning ? 'animate-bulb-blink' : 'animate-neon-pulse'}`}
          style={{
            animationDelay: isSpinning ? `${bulb.blinkDelay}s` : `${bulb.delay}s`,
            backgroundColor: 'currentColor',
          }}
        />
      ))}
    </div>
  );
}
