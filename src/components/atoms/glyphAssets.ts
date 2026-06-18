import type { ImageSourcePropType } from 'react-native';

// Emoji character -> bundled art asset. The emoji character is the stable token
// every call site passes to <Glyph>; this is the one place those characters bind
// to pixels. Art set: Microsoft Fluent Emoji (3D), MIT-licensed.
//
// Add a row here to migrate a new emoji; an emoji absent from this map falls back
// to the OS text glyph in <Glyph>.
export const GLYPH_ASSETS: Record<string, ImageSourcePropType> = {
    '🌱': require('../../assets/emoji/sprout.png'),
    '⚡': require('../../assets/emoji/spark.png'),
    '🔥': require('../../assets/emoji/fire.png'),
    '💎': require('../../assets/emoji/gem.png'),
    '🌟': require('../../assets/emoji/star.png'),
    '👑': require('../../assets/emoji/crown.png'),
    '🪜': require('../../assets/emoji/ladder.png'),
    '💰': require('../../assets/emoji/drop.png'),
    '🎡': require('../../assets/emoji/wheel.png'),
};
