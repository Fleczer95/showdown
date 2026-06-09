import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Short accent-colored tab centered atop a question/puzzle card. */
function AccentTab({ color }: { color: string }) {
    return <View style={[styles.tab, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
    tab: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
    },
});

export default React.memo(AccentTab);
