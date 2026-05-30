import React from 'react';
import { type ViewStyle } from 'react-native';
import Stack from '../atoms/Stack';
import Skeleton from '../atoms/Skeleton';

export type SkeletonRowVariant = 'avatar-text' | 'text' | 'card' | 'heading-text';

export interface SkeletonGroupProps {
    /** Predefined row layout pattern */
    variant?: SkeletonRowVariant;
    /** Number of rows to repeat (default varies by variant) */
    rows?: number;
    /** Gap between rows */
    gap?: 'sm' | 'md' | 'lg';
    style?: ViewStyle;
    testID?: string;
}

/**
 * Composed skeleton placeholder for common loading patterns.
 * Uses a single animation loop shared across all skeleton items.
 */
function SkeletonGroup({ variant = 'text', rows, gap = 'md', style, testID }: SkeletonGroupProps) {
    const defaultRows: Record<SkeletonRowVariant, number> = {
        'avatar-text': 3,
        text: 4,
        card: 2,
        'heading-text': 3,
    };
    const count = rows ?? defaultRows[variant];

    return (
        <Stack gap={gap} style={style} testID={testID}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonRow key={i} variant={variant} />
            ))}
        </Stack>
    );
}

function SkeletonRow({ variant }: { variant: SkeletonRowVariant }) {
    switch (variant) {
        case 'avatar-text':
            return (
                <Stack direction='horizontal' gap='md' align='center'>
                    <Skeleton variant='circle' width={40} height={40} />
                    <Stack gap='sm' style={{ flex: 1 }}>
                        <Skeleton variant='text' width='60%' />
                        <Skeleton variant='text' width='40%' />
                    </Stack>
                </Stack>
            );
        case 'text':
            return (
                <Stack gap='sm'>
                    <Skeleton variant='text' width='100%' />
                    <Skeleton variant='text' width='85%' />
                    <Skeleton variant='text' width='70%' />
                </Stack>
            );
        case 'card':
            return <Skeleton variant='card' />;
        case 'heading-text':
            return (
                <Stack gap='sm'>
                    <Skeleton variant='rect' width='50%' height={24} />
                    <Skeleton variant='text' width='100%' />
                    <Skeleton variant='text' width='90%' />
                </Stack>
            );
    }
}

export default React.memo(SkeletonGroup);
