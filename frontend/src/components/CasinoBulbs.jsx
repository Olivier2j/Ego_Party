import React, { useMemo } from 'react';

const IS_MOBILE_UA = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

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
      blinkDelay: (i * 0.05) % 0.3,
    }));
  }, [count]);

  const positionClasses = {
    top: 'absolute -top-3 left-0 right-0 flex justify-around px-8',
    bottom: 'absolute -bottom-3 left-0 right-0 flex justify-around px-8',
    left: 'absolute left-0 top-0 bottom-0 -translate-x-3 flex flex-col justify-around py-8',
    right: 'absolute right-0 top-0 bottom-0 translate-x-3 flex flex-col justify-around py-8',
  };

  // Mobile: use lighter animations — no box-shadow glow animation, no filter:brightness,
  // no continuous pulse when idle. This drastically reduces GPU cost on mobile.
  const animationClass = IS_MOBILE_UA
    ? (isSpinning ? 'animate-bulb-blink-mobile' : '')
    : (isSpinning ? 'animate-bulb-blink' : 'animate-neon-pulse');

  return (
    <div className={positionClasses[position]}>
      {bulbs.map((bulb) => (
        <div
          key={bulb.id}
          className={`casino-bulb ${IS_MOBILE_UA ? 'casino-bulb-mobile' : ''} ${bulb.color} ${animationClass}`}
          style={{
            animationDelay: isSpinning ? `${bulb.blinkDelay}s` : `${bulb.delay}s`,
            backgroundColor: 'currentColor',
          }}
        />
      ))}
    </div>
  );
}
