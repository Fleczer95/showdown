import React from 'react';
import { View } from 'react-native';
import { useResponsive } from '../../responsive/useResponsive';

export default function HeaderPlaceholder() {
    const { scale } = useResponsive();
    return <View style={{ width: scale(36), height: scale(36) }} />;
}
