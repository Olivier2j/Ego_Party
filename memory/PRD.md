# Ego Party — PRD

## Concept
Native React Native (Expo) mobile app: a single-slot Las Vegas–style slot machine.
The user drags a horizontal red knob (real swipe gesture, not a tap) to spin a reel of
166 built-in photos. One photo is selected cryptographically at random; the title
"EGO PARTY" blinks for ~2 s synchronized with the ding sound.

## Tech Stack
- Expo SDK 54 (Expo Router file-based routing)
- React Native 0.81 + React 19
- react-native-reanimated v4 (worklet-based UI-thread animation, 60 FPS target)
- react-native-gesture-handler v2 (Gesture.Pan for the slider)
- expo-image (memory-disk caching)
- expo-av (sounds)
- expo-haptics, expo-crypto, expo-asset, expo-screen-orientation
- @expo-google-fonts/bungee (Bungee retro-casino title font)

## Visual Design (matches the user's reference screenshot)
- Black background (#000)
- Casino-green machine body (#1f4d36)
- Double bronze frame (outer + inner trace) with alternating yellow/red bulbs
  on all 4 sides (top, bottom, left, right)
- Title "EGO PARTY" (Bungee, bronze) + subtitle "SLOT MACHINE"
- Two flat bronze bandeaux above and below the photo viewer
- Landscape photo viewer (≈16:10), bronze + black frame
- Horizontal slider track at the bottom with a 3D red ball ("SLIDE TO SPIN ▶")
- Footer hint "Slide the red knob right →"

## Critical Behavior
- **Animation runs on the UI thread** via Reanimated worklets (`useSharedValue` +
  `withTiming` + `Easing.bezier(0.15, 0.7, 0.2, 1.0)`). No setState during the
  ~2 s spin → 60 FPS on iPhone 13 Pro / iPad Pro.
- **Real swipe required**: Gesture.Pan tracks the finger from left to right; the
  spin only triggers when the knob crosses 85 % of the track. Otherwise the knob
  springs back to the left. The knob also auto-resets after each spin.
- **Crypto-secure random** (`expo-crypto.getRandomBytes`) with no immediate repeat.
- **Photos** (166 × ~22 KB JPEG, total ~3.6 MB) are bundled via `require()`
  → fully offline.
- **Sounds**: `tick.wav` pool of 5 instances replayed with progressively wider
  intervals (45 → 265 ms) to mimic deceleration; `ding.wav` (~2.03 s) plays at
  the reveal.
- **Title blink** is driven by a JS interval scheduled to last exactly the ding
  duration (2030 ms / 180 ms ≈ 11 toggles).
- **Haptics**: Medium impact at spin start, Success notification at reveal.
- **Portrait lock** via `expo-screen-orientation`.

## Project Structure
```
/app/frontend/
├── app/
│   ├── _layout.tsx          # GestureHandlerRoot + SafeAreaProvider + portrait lock
│   └── index.tsx            # Main slot machine screen
├── src/
│   └── photos.ts            # 166 require()'d JPEGs
├── assets/
│   ├── photos/              # photo_001.jpg … photo_166.jpg
│   └── sounds/
│       ├── tick.wav         # generated procedurally (sine click)
│       └── ding.wav         # generated procedurally (decaying chime)
└── app.json                 # Ego Party identity + Bungee splash + orientation
```

## Status
- Web preview verified end-to-end: layout, photo display, slider drag,
  spin animation triggered, reel deceleration, photo reveal.
- **MOCKED**: Sounds are procedurally-generated WAV placeholders (sine + decaying
  chime). Replace `/app/frontend/assets/sounds/{tick,ding}.wav` with final SFX.
- Native (Expo Go) not yet validated on device — requires the user to scan the
  QR code on iPhone 13 Pro / iPad Pro to confirm the 60 FPS target.

## Deliverables
1. ✅ Expo Go-runnable code (QR via tunnel)
2. ✅ `app.json` configured (identity, portrait lock, dark UI, splash bg #000)
3. 🔜 EAS build for TestFlight / APK (next step on user request)
