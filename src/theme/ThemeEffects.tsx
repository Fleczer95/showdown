import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useThemeActions } from './context';
import { LeafEffect } from './effects/LeafEffect';
import { AuroraEffect } from './effects/AuroraEffect';
import { WaveEffect } from './effects/WaveEffect';
import { DefaultGlowEffect } from './effects/DefaultGlowEffect';

export const ThemeEffects = () => {
    const { themeId } = useThemeActions();

    // Specific effects for premium/specialized themes
    const hasSpecialEffect = ['nature', 'forest', 'aurora', 'ocean'].includes(themeId);

    // Default glow effect for other themes to make the app feel alive
    const useDefaultEffect = ['party', 'pastel', 'minimal', 'dark', 'midnight', 'sunset'].includes(themeId);

    if (!hasSpecialEffect && !useDefaultEffect) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            <Canvas style={StyleSheet.absoluteFill}>
                {(themeId === 'nature' || themeId === 'forest') && <LeafEffect />}
                {themeId === 'aurora' && <AuroraEffect />}
                {themeId === 'ocean' && <WaveEffect />}
                {useDefaultEffect && <DefaultGlowEffect />}
            </Canvas>
        </View>
    );
};
