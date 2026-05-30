import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, TextInput as RNTextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Pressable from '../atoms/HapticPressable';
import Text from '../atoms/Text';
import { useTheme } from '../../theme';

export interface InputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    /** Controls editability without dimming (unlike disabled) */
    editable?: boolean;
    label?: string;
    multiline?: boolean;
    numberOfLines?: number;
    /** Container style override */
    wrapperStyle?: ViewStyle;
    testID?: string;
    accessibilityLabel?: string;
    /** Commonly forwarded TextInput props */
    autoFocus?: boolean;
    keyboardType?: TextInputProps['keyboardType'];
    returnKeyType?: TextInputProps['returnKeyType'];
    secureTextEntry?: boolean;
    autoCapitalize?: TextInputProps['autoCapitalize'];
    autoCorrect?: boolean;
    onSubmitEditing?: TextInputProps['onSubmitEditing'];
    onBlur?: TextInputProps['onBlur'];
    onFocus?: TextInputProps['onFocus'];
    blurOnSubmit?: boolean;
    maxLength?: number;
    returnKeyLabel?: TextInputProps['returnKeyLabel'];
    textAlign?: 'left' | 'center' | 'right';
    /** Show clear button when input has value */
    clearable?: boolean;
    /** Left accessory element (e.g. search icon) */
    leftAccessory?: React.ReactNode;
    /** Right accessory element (e.g. password toggle) */
    rightAccessory?: React.ReactNode;
}

function Input({
    value,
    onChangeText,
    placeholder,
    error,
    disabled,
    label,
    multiline,
    numberOfLines,
    wrapperStyle,
    testID,
    accessibilityLabel,
    autoFocus,
    keyboardType,
    returnKeyType,
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    onSubmitEditing,
    onBlur: onBlurProp,
    onFocus: onFocusProp,
    textAlign,
    clearable = false,
    leftAccessory,
    rightAccessory,
    blurOnSubmit,
    maxLength,
    returnKeyLabel,
    editable,
}: InputProps) {
    const t = useTheme();
    const [focused, setFocused] = useState(false);
    const shakeOffset = useSharedValue(0);
    const prevErrorRef = useRef(error);
    const v = t.components.input.default;
    const borderColor = error
        ? t.components.input.error.border
        : focused
          ? t.components.input.focused.border
          : v.border;
    const bgColor = disabled ? t.colors.surfaceVariant : v.bg;

    // Shake animation when error appears
    useEffect(() => {
        if (error && error !== prevErrorRef.current) {
            shakeOffset.value = withSequence(
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(-6, { duration: 50 }),
                withTiming(6, { duration: 50 }),
                withTiming(0, { duration: 50 }),
            );
        }
        prevErrorRef.current = error;
    }, [error, shakeOffset]);

    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }],
    }));

    const handleFocus = useMemo(
        () => (e: any) => {
            setFocused(true);
            onFocusProp?.(e);
        },
        [onFocusProp],
    );

    const handleBlur = useMemo(
        () => (e: any) => {
            setFocused(false);
            onBlurProp?.(e);
        },
        [onBlurProp],
    );

    const containerStyle = useMemo(
        () => [
            styles.input,
            {
                backgroundColor: bgColor,
                borderColor,
                borderRadius: t.radii.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
                color: v.text,
                fontSize: t.typography.md,
                textAlign: textAlign ?? 'left',
            },
        ],
        [bgColor, borderColor, t.radii.md, t.spacing.md, t.spacing.sm, v.text, t.typography.md, textAlign],
    );

    const placeholderColor = useMemo(() => v.placeholder, [v.placeholder]);

    return (
        <Animated.View testID={testID} style={[styles.wrapper, wrapperStyle, shakeStyle]}>
            {label ? (
                <Text
                    variant='caption'
                    color={t.colors.textSecondary}
                    style={{ marginBottom: t.spacing.sm }}
                    weight='medium'
                >
                    {label}
                </Text>
            ) : null}
            <View style={styles.inputRow}>
                {leftAccessory ? (
                    <View style={styles.accessory} pointerEvents='none'>
                        {leftAccessory}
                    </View>
                ) : null}
                <RNTextInput
                    style={[containerStyle, styles.flexInput]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderColor}
                    editable={editable !== undefined ? editable : !disabled}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    accessibilityLabel={accessibilityLabel ?? label}
                    maxFontSizeMultiplier={1.5}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    textAlignVertical={multiline ? ('top' as const) : undefined}
                    autoFocus={autoFocus}
                    keyboardType={keyboardType}
                    returnKeyType={returnKeyType}
                    secureTextEntry={secureTextEntry}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={autoCorrect}
                    onSubmitEditing={onSubmitEditing}
                    blurOnSubmit={blurOnSubmit}
                    maxLength={maxLength}
                    returnKeyLabel={returnKeyLabel}
                />
                {clearable && value ? (
                    <Pressable
                        onPress={() => onChangeText('')}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityLabel='Clear'
                        accessibilityRole='button'
                        style={styles.clearButton}
                    >
                        <Text variant='body' color={t.colors.textSecondary}>
                            ✕
                        </Text>
                    </Pressable>
                ) : null}
                {rightAccessory ? (
                    <View style={styles.accessory} pointerEvents='none'>
                        {rightAccessory}
                    </View>
                ) : null}
            </View>
            {error ? (
                <Text variant='overline' color={t.colors.error} style={{ marginTop: t.spacing.xs }}>
                    {error}
                </Text>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        includeFontPadding: false,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    flexInput: {
        flex: 1,
    },
    clearButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    accessory: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    wrapper: {
        width: '100%',
        paddingHorizontal: 16,
    },
});

export default React.memo(Input);
