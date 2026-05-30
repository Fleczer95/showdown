import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, type ScrollViewProps } from 'react-native';
import { useTheme } from '../../theme';

export interface FadingScrollViewProps extends ScrollViewProps {
    fadeHeight?: number;
}

export default function FadingScrollView({
    fadeHeight = 48,
    onScroll,
    scrollEventThrottle,
    children,
    ...rest
}: FadingScrollViewProps) {
    const t = useTheme();
    const [atBottom, setAtBottom] = useState(false);

    return (
        <View style={styles.wrapper}>
            <ScrollView
                {...rest}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={scrollEventThrottle ?? 100}
                onScroll={(e) => {
                    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                    setAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 10);
                    onScroll?.(e);
                }}
            >
                {children}
            </ScrollView>
            {!atBottom && (
                <View style={[styles.fade, { height: fadeHeight }]} pointerEvents='none'>
                    {[0, 0.15, 0.35, 0.6, 0.85].map((opacity, i) => (
                        <View key={i} style={[styles.fadeSlice, { backgroundColor: t.colors.surface, opacity }]} />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        flexShrink: 1,
    },
    fade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'column',
    },
    fadeSlice: {
        flex: 1,
    },
});
