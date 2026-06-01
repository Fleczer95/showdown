import React from 'react';
import { View, StyleSheet } from 'react-native';
import Pressable from '../atoms/HapticPressable';
import Text from '../atoms/Text';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface ToggleOption {
    value: string;
    label: string;
    icon?: any;
}

export interface ToggleGroupProps {
    /** Selected value (single mode) or selected values array (multiple mode) */
    value: string | string[];
    options: ToggleOption[];
    /** Callback with selected value(s) */
    onChange: (value: string | string[]) => void;
    /** Enable multi-select mode */
    multiple?: boolean;
    /** Disable specific options by value */
    disabledOptions?: string[];
    testID?: string;
}

function ToggleGroup({ value, options, onChange, multiple = false, disabledOptions, testID }: ToggleGroupProps) {
    const t = useTheme();

    const isActive = (optionValue: string): boolean => {
        return multiple ? (value as string[]).includes(optionValue) : value === optionValue;
    };

    const handlePress = (optionValue: string) => {
        if (multiple) {
            const current = value as string[];
            const next = current.includes(optionValue)
                ? current.filter((v) => v !== optionValue)
                : [...current, optionValue];
            onChange(next);
        } else {
            onChange(optionValue);
        }
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: t.colors.background,
                    borderRadius: t.radii.lg,
                    padding: t.spacing.xs,
                    minHeight: t.spacing.xxl + t.spacing.lg, // approx 48
                },
            ]}
            testID={testID}
            accessibilityRole={multiple ? 'radiogroup' : 'tablist'}
        >
            {options.map((option) => {
                const active = isActive(option.value);

                return (
                    <View key={option.value} style={styles.itemWrapper}>
                        <ToggleItem
                            label={option.label}
                            icon={option.icon}
                            active={active}
                            disabled={disabledOptions?.includes(option.value)}
                            onPress={() => handlePress(option.value)}
                        />
                    </View>
                );
            })}
        </View>
    );
}

function ToggleItem({
    label,
    icon: Icon,
    active,
    disabled,
    onPress,
}: {
    label: string;
    icon?: any;
    active: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const t = useTheme();
    const { iconSize } = useResponsive();

    return (
        <Pressable
            style={[
                styles.item,
                {
                    backgroundColor: active ? t.colors.surface : 'transparent',
                    borderRadius: t.radii.md,
                    opacity: disabled ? 0.5 : 1,
                    paddingVertical: t.spacing.md - 2, // approx 10
                    paddingHorizontal: t.spacing.sm,
                    // More pronounced shadow for visibility on surface
                    ...(active
                        ? {
                              shadowColor: t.colors.shadow,
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.15,
                              shadowRadius: 2,
                              elevation: 2,
                          }
                        : {}),
                },
            ]}
            onPress={onPress}
            haptic='light'
            disabled={disabled}
            accessibilityRole='button'
            accessibilityState={{ selected: active, disabled }}
        >
            <View style={styles.itemContent}>
                {Icon && (
                    <Icon
                        size={iconSize(16)}
                        color={active ? t.colors.primary : t.colors.textSecondary}
                        style={[styles.itemIcon, { marginRight: t.spacing.sm - 2 }]}
                    />
                )}
                <Text
                    variant='body'
                    color={active ? t.colors.text : t.colors.textSecondary}
                    weight={active ? 'bold' : 'semibold'}
                    align='center'
                    style={styles.itemLabel}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    itemWrapper: {
        flex: 1,
        minWidth: 0,
    },
    item: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '100%',
    },
    itemIcon: {},
    itemLabel: {
        flexShrink: 1,
        minWidth: 0,
    },
});

export default React.memo(ToggleGroup);
