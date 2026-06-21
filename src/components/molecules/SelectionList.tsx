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
    /** Short hint shown as a chip on a locked tile, e.g. the level required to unlock it. */
    lockLabel?: string;
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
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();
    const isGrid = numColumns > 1;

    // Fluid sizing so the widget keeps pace with the scaled type/spacing tokens on tablet.
    const metrics = React.useMemo(() => {
        const iconBox = isGrid ? scale(48) : scale(40);
        const iconBoxRadius = isGrid ? theme.radii.lg : theme.radii.md;
        return {
            iconBoxRadius,
            iconContainerOverride: isGrid
                ? {
                      width: iconBox,
                      height: iconBox,
                      borderRadius: iconBoxRadius,
                      marginBottom: theme.spacing.sm,
                  }
                : {
                      width: iconBox,
                      height: iconBox,
                      borderRadius: iconBoxRadius,
                      marginRight: theme.spacing.md,
                  },
            checkSize: scale(24),
            gridCheckSize: scale(18),
            gridItemHeight: scale(132),
            dividerInset: iconBox + theme.spacing.md,
        };
    }, [isGrid, scale, theme]);

    const {
        iconBoxRadius,
        iconContainerOverride,
        checkSize,
        gridCheckSize,
        gridItemHeight,
        dividerInset,
    } = metrics;

    return (
        <View style={[styles.container, { paddingHorizontal: theme.spacing.lg }]} testID={testID}>
            {label && (
                <Text
                    variant='caption'
                    color={theme.colors.textSecondary}
                    style={[styles.label, { marginBottom: theme.spacing.sm }]}
                    weight='medium'
                >
                    {label}
                </Text>
            )}
            <View
                style={[
                    isGrid && (styles.gridContainer as ViewStyle),
                    isGrid && { marginHorizontal: -theme.spacing.sm },
                ]}
            >
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
                                            backgroundColor: isActive
                                                ? theme.colors.primary + '10'
                                                : 'transparent',
                                            borderRadius: theme.radii.lg,
                                            borderWidth: isGrid ? 2 : 0,
                                            borderColor: isActive ? theme.colors.primary : 'transparent',
                                            marginVertical: theme.spacing.xs,
                                        },
                                        isGrid ? { height: gridItemHeight, margin: theme.spacing.sm } : null,
                                        !isGrid && {
                                            paddingVertical: theme.spacing.md,
                                            paddingHorizontal: theme.spacing.md,
                                        },
                                        isGrid && {
                                            paddingVertical: theme.spacing.lg,
                                            paddingHorizontal: theme.spacing.sm,
                                        },
                                    ] as any
                                }
                                haptic='light'
                            >
                                <View
                                    pointerEvents='none'
                                    style={[
                                        styles.itemContent,
                                        isGrid && (styles.gridItemContent as ViewStyle),
                                    ]}
                                >
                                    {IconComponent && (
                                        <Icon
                                            name={IconComponent}
                                            size={iconSize(isGrid ? 32 : 24)}
                                            color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                                            backgroundColor={
                                                isActive
                                                    ? theme.colors.primary + '15'
                                                    : theme.colors.borderLight + '40'
                                            }
                                            borderRadius={iconBoxRadius}
                                            containerStyle={
                                                [
                                                    styles.iconContainer,
                                                    isGrid ? styles.gridIconContainer : undefined,
                                                    iconContainerOverride,
                                                    option.isLocked && styles.lockedDim,
                                                ] as any
                                            }
                                        />
                                    )}
                                    <View
                                        style={[
                                            styles.textContainer,
                                            isGrid && styles.gridTextContainer,
                                            option.isLocked && styles.lockedDim,
                                        ]}
                                    >
                                        <Text
                                            variant='body'
                                            weight={isActive ? 'bold' : 'semibold'}
                                            color={isActive ? theme.colors.primary : theme.colors.text}
                                            align={isGrid ? 'center' : 'left'}
                                            numberOfLines={isGrid ? 2 : undefined}
                                        >
                                            {option.label}
                                        </Text>
                                    </View>
                                    {option.isLocked && option.lockLabel && (
                                        <View
                                            style={[
                                                styles.levelChip,
                                                isGrid && { marginTop: theme.spacing.xs },
                                                {
                                                    backgroundColor: theme.colors.borderLight + '60',
                                                    borderColor: theme.colors.border,
                                                    paddingHorizontal: theme.spacing.sm,
                                                    paddingVertical: scale(2),
                                                    borderRadius: theme.radii.full,
                                                },
                                            ]}
                                        >
                                            <Text variant='caption' weight='bold' color={theme.colors.textSecondary}>
                                                {option.lockLabel}
                                            </Text>
                                        </View>
                                    )}
                                    {option.isLocked && (
                                        <View
                                            style={[
                                                styles.lockBadge,
                                                {
                                                    backgroundColor: theme.colors.overlay + '20',
                                                    padding: theme.spacing.xs,
                                                    borderRadius: theme.radii.sm,
                                                },
                                            ]}
                                        >
                                            <Lock
                                                size={iconSize(isGrid ? 14 : 12)}
                                                color={theme.colors.textSecondary}
                                            />
                                        </View>
                                    )}
                                    {isGrid && multiSelect && isActive && (
                                        <View
                                            style={[
                                                styles.gridCheckmark,
                                                {
                                                    backgroundColor: theme.colors.primary,
                                                    width: gridCheckSize,
                                                    height: gridCheckSize,
                                                    borderRadius: gridCheckSize / 2,
                                                    top: theme.spacing.xs,
                                                    right: theme.spacing.xs,
                                                },
                                            ]}
                                        >
                                            <Check
                                                size={iconSize(10)}
                                                color={theme.colors.onPrimary}
                                                strokeWidth={3}
                                            />
                                        </View>
                                    )}
                                </View>
                                {!isGrid && isActive && (
                                    <View
                                        style={[
                                            styles.checkmark,
                                            {
                                                backgroundColor: theme.colors.primary,
                                                width: checkSize,
                                                height: checkSize,
                                                borderRadius: checkSize / 2,
                                                marginLeft: theme.spacing.sm,
                                            },
                                        ]}
                                    >
                                        <Check
                                            size={iconSize(14)}
                                            color={theme.colors.onPrimary}
                                            strokeWidth={3}
                                        />
                                    </View>
                                )}
                            </Pressable>
                            {!isGrid &&
                                index < options.length - 1 &&
                                !isActive &&
                                option.value !== options[index + 1].value && (
                                    <Divider
                                        marginVertical={theme.spacing.xs}
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
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    label: {},
    fullWidth: {
        width: '100%',
    },
    item: {},
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gridItem: {
        alignItems: 'center',
        justifyContent: 'center',
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
    },
    lockBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    lockedDim: {
        opacity: 0.4,
    },
    levelChip: {
        borderWidth: 1,
        alignSelf: 'center',
    },
    gridCheckmark: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(SelectionList);
