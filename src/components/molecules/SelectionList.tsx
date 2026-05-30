import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import Pressable from '../atoms/HapticPressable';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import Divider from '../atoms/Divider';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface SelectionOption {
    value: string;
    label: string;
    icon?: any;
    description?: string;
    isPremium?: boolean;
    isLocked?: boolean;
}

export interface SelectionListProps {
    label?: string;
    value: string[];
    options: SelectionOption[];
    onChange: (value: string) => void;
    numColumns?: number;
    multiSelect?: boolean;
    testID?: string;
}

function SelectionList({
    label,
    value,
    options,
    onChange,
    numColumns = 1,
    multiSelect = false,
    testID,
}: SelectionListProps) {
    const t = useTheme();
    const { scale, iconSize } = useResponsive();
    const isGrid = numColumns > 1;

    // Fluid sizing so the widget keeps pace with the scaled type/spacing tokens on tablet.
    const metrics = React.useMemo(() => {
        const iconBox = isGrid ? scale(48) : scale(40);
        const iconBoxRadius = isGrid ? scale(16) : scale(12);
        return {
            iconBoxRadius,
            iconContainerOverride: isGrid
                ? { width: iconBox, height: iconBox, borderRadius: iconBoxRadius, marginBottom: scale(8) }
                : { width: iconBox, height: iconBox, borderRadius: iconBoxRadius, marginRight: scale(12) },
            checkSize: scale(24),
            gridCheckSize: scale(18),
            gridItemHeight: scale(132),
            dividerInset: iconBox + scale(12),
        };
    }, [isGrid, scale]);

    const { iconBoxRadius, iconContainerOverride, checkSize, gridCheckSize, gridItemHeight, dividerInset } = metrics;

    return (
        <View style={styles.container} testID={testID}>
            {label && (
                <Text variant='caption' color={t.colors.textSecondary} style={styles.label} weight='medium'>
                    {label}
                </Text>
            )}
            <View style={[isGrid && (styles.gridContainer as ViewStyle)]}>
                {options.map((option, index) => {
                    const isActive = value.includes(option.value);
                    const IconComponent = option.icon;

                    return (
                        <View
                            key={option.value}
                            style={[isGrid ? { width: `${100 / numColumns}%` } : styles.fullWidth]}
                        >
                            <Pressable
                                onPress={() => onChange(option.value)}
                                style={
                                    [
                                        styles.item,
                                        isGrid ? styles.gridItem : styles.listItem,
                                        {
                                            backgroundColor: isActive ? t.colors.primary + '10' : 'transparent',
                                            borderRadius: t.radii.lg,
                                            borderWidth: isGrid ? 2 : 0,
                                            borderColor: isActive ? t.colors.primary : 'transparent',
                                        },
                                        isGrid ? { height: gridItemHeight } : null,
                                    ] as any
                                }
                                haptic='light'
                            >
                                <View
                                    pointerEvents='none'
                                    style={[styles.itemContent, isGrid && (styles.gridItemContent as ViewStyle)]}
                                >
                                    {IconComponent && (
                                        <Icon
                                            name={IconComponent}
                                            size={iconSize(isGrid ? 32 : 24)}
                                            color={isActive ? t.colors.primary : t.colors.textSecondary}
                                            backgroundColor={
                                                isActive ? t.colors.primary + '15' : t.colors.borderLight + '40'
                                            }
                                            borderRadius={iconBoxRadius}
                                            containerStyle={
                                                [
                                                    styles.iconContainer,
                                                    isGrid ? styles.gridIconContainer : undefined,
                                                    iconContainerOverride,
                                                ] as any
                                            }
                                        />
                                    )}
                                    <View style={[styles.textContainer, isGrid && styles.gridTextContainer]}>
                                        <Text
                                            variant='body'
                                            weight={isActive ? 'bold' : 'semibold'}
                                            color={isActive ? t.colors.primary : t.colors.text}
                                            align={isGrid ? 'center' : 'left'}
                                            numberOfLines={isGrid ? 2 : undefined}
                                        >
                                            {option.label}
                                        </Text>
                                    </View>
                                    {option.isPremium && option.isLocked && (
                                        <View style={styles.lockBadge}>
                                            <Lock size={iconSize(isGrid ? 14 : 12)} color={t.colors.textSecondary} />
                                        </View>
                                    )}
                                    {isGrid && multiSelect && isActive && (
                                        <View
                                            style={[
                                                styles.gridCheckmark,
                                                {
                                                    backgroundColor: t.colors.primary,
                                                    width: gridCheckSize,
                                                    height: gridCheckSize,
                                                    borderRadius: gridCheckSize / 2,
                                                },
                                            ]}
                                        >
                                            <Check size={iconSize(10)} color='#fff' strokeWidth={3} />
                                        </View>
                                    )}
                                </View>
                                {!isGrid && isActive && (
                                    <View
                                        style={[
                                            styles.checkmark,
                                            {
                                                backgroundColor: t.colors.primary,
                                                width: checkSize,
                                                height: checkSize,
                                                borderRadius: checkSize / 2,
                                            },
                                        ]}
                                    >
                                        <Check size={iconSize(14)} color='#fff' strokeWidth={3} />
                                    </View>
                                )}
                            </Pressable>
                            {!isGrid &&
                                index < options.length - 1 &&
                                !isActive &&
                                option.value !== options[index + 1].value && (
                                    <Divider
                                        marginVertical={4}
                                        style={{ marginLeft: IconComponent ? dividerInset : 0 }}
                                    />
                                )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    label: {
        marginBottom: 8,
    },
    fullWidth: {
        width: '100%',
    },
    item: {
        marginVertical: 4,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    gridItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 8,
        margin: 6,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    gridItemContent: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    gridIconContainer: {
        marginRight: 0,
    },
    textContainer: {
        flex: 1,
    },
    gridTextContainer: {
        flex: 0,
    },
    checkmark: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    lockBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 4,
        borderRadius: 8,
    },
    gridCheckmark: {
        position: 'absolute',
        top: 4,
        right: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(SelectionList);
