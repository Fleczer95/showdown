import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Blur } from '@shopify/react-native-skia';
import { useThemeActions, useBlur } from './context';
import { LeafEffect } from './effects/LeafEffect';
import { AuroraEffect } from './effects/AuroraEffect';
import { WaveEffect } from './effects/WaveEffect';
import { DefaultGlowEffect } from './effects/DefaultGlowEffect';

export const ThemeEffects = () => {
    const { themeId } = useThemeActions();
    const { isBlurry } = useBlur();

    // Specific effects for premium/specialized themes
    const specialEffects: Record<string, React.ReactNode> = {
        nature: <LeafEffect />,
        forest: <LeafEffect />,
        aurora: <AuroraEffect />,
        ocean: <WaveEffect />,
    };

    const SpecialEffect = specialEffects[themeId];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            <Canvas style={StyleSheet.absoluteFill}>
                <Group>
                    {isBlurry && <Blur blur={350} />}
                    {SpecialEffect || <DefaultGlowEffect />}
                </Group>
            </Canvas>
        </View>
    );
};
