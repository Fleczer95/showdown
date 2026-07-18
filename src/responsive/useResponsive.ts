import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { getBreakpoint, type Breakpoint } from './breakpoints';
import { tabletProgress } from './scale';

/** Centred content column cap (portrait tablet). */
export const MAX_CONTENT_WIDTH = 720;
/** Wider cap for tablet landscape, where more horizontal space is available. */
export const MAX_CONTENT_WIDTH_LANDSCAPE = 960;

export interface ResponsiveInfo {
    width: number;
    height: number;
    /** OS text scaling multiplier from the current Dynamic Type / font-size setting. */
    fontScale: number;
    breakpoint: Breakpoint;
    isTablet: boolean;
    /** Orientation-aware max width for the centred content column. */
    contentMaxWidth: number;
    /** Ready-made style that caps + centres a content column on tablet (undefined on phone). */
    tabletColumn: { maxWidth: number; width: '100%'; alignSelf: 'center' } | undefined;
    scale: (phone: number, tablet?: number) => number;
    iconSize: (phone: number, tablet?: number) => number;
}

export function useResponsive(): ResponsiveInfo {
    const { width, height, fontScale } = useWindowDimensions();

    // Memoised on dimensions so consumers get stable function/object identities
    // between renders — otherwise the fresh `scale`/`iconSize`/`tabletColumn` defeat
    // downstream React.memo in the ~25 components that read this hook.
    return useMemo(() => {
        const breakpoint = getBreakpoint(width, height);
        const isTablet = breakpoint === 'expanded';

        // Same fluid curve as the theme tokens — continuous, no jump at the breakpoint.
        const progress = tabletProgress(Math.min(width, height));

        const scale = (phone: number, tablet?: number) => phone + ((tablet ?? phone * 1.5) - phone) * progress;
        const iconSize = (phone: number, tablet?: number) =>
            Math.round(phone + ((tablet ?? phone * 1.45) - phone) * progress);

        const isLandscape = width > height;
        const contentMaxWidth = isTablet && isLandscape ? MAX_CONTENT_WIDTH_LANDSCAPE : MAX_CONTENT_WIDTH;
        const tabletColumn = isTablet
            ? { maxWidth: contentMaxWidth, width: '100%' as const, alignSelf: 'center' as const }
            : undefined;

        return { width, height, fontScale, breakpoint, isTablet, contentMaxWidth, tabletColumn, scale, iconSize };
    }, [width, height, fontScale]);
}
