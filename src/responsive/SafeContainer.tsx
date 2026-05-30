import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { ThemeEffects } from '../theme/ThemeEffects';

interface SafeContainerProps {
    children: React.ReactNode;
    style?: View['props']['style'];
    testID?: string;
    edges?: ('top' | 'right' | 'bottom' | 'left')[];
    disableEffects?: boolean;
}

function SafeContainer({
    children,
    style,
    testID,
    edges = ['top', 'right', 'bottom', 'left'],
    disableEffects = false,
}: SafeContainerProps) {
    const insets = useSafeAreaInsets();
    const t = useTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: t.colors.background,
                    paddingTop: edges.includes('top') ? insets.top : 0,
                    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
                    paddingLeft: edges.includes('left') ? insets.left : 0,
                    paddingRight: edges.includes('right') ? insets.right : 0,
                },
                style,
            ]}
            testID={testID}
        >
            {!disableEffects && <ThemeEffects />}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default React.memo(SafeContainer);
