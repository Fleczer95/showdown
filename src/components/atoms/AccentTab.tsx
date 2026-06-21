import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsive } from '../../responsive/useResponsive';

/** Short accent-colored tab centered atop a question/puzzle card. */
function AccentTab({ color }: { color: string }) {
    const { scale } = useResponsive();
    return <View style={[styles.tab, { backgroundColor: color, width: scale(40), height: scale(4), borderRadius: scale(2) }]} />;
}

const styles = StyleSheet.create({
    tab: {
        alignSelf: 'center',
    },
});

export default React.memo(AccentTab);
