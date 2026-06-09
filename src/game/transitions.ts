import { FadeInDown } from 'react-native-reanimated';

/** Shared springy fade-in for play-screen cards/options. Pass a per-item delay (ms) to stagger. */
export const springEnter = (delay = 0) => FadeInDown.delay(delay).springify().damping(20).stiffness(150);
