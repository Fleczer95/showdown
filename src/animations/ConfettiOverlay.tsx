import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Confetti from './Confetti';

export const CONFETTI_OVERLAY_MS = 3200;

interface ConfettiBurst {
    id: number;
    colors: string[];
}

interface ConfettiOverlayValue {
    burstConfetti: (colors: string[]) => void;
}

const ConfettiOverlayContext = createContext<ConfettiOverlayValue | null>(null);

/**
 * App-root visual-effects host. Confetti is an absolute, touch-transparent sibling
 * of the navigation tree rather than a native Modal, so it can never compete with
 * review/share sheets for the platform's single presentation slot.
 */
export function ConfettiOverlayProvider({ children }: { children: React.ReactNode }) {
    const [burst, setBurst] = useState<ConfettiBurst | null>(null);
    const nextId = useRef(0);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const burstConfetti = useCallback((colors: string[]) => {
        if (clearTimer.current) clearTimeout(clearTimer.current);

        const id = ++nextId.current;
        setBurst({ id, colors });
        clearTimer.current = setTimeout(() => {
            setBurst((current) => (current?.id === id ? null : current));
            clearTimer.current = null;
        }, CONFETTI_OVERLAY_MS);
    }, []);

    useEffect(
        () => () => {
            if (clearTimer.current) clearTimeout(clearTimer.current);
        },
        [],
    );

    const value = useMemo(() => ({ burstConfetti }), [burstConfetti]);

    return (
        <ConfettiOverlayContext.Provider value={value}>
            <View style={styles.root}>
                {children}
                {burst ? (
                    <View
                        key={burst.id}
                        testID='confetti-overlay'
                        pointerEvents='none'
                        importantForAccessibility='no-hide-descendants'
                        style={styles.overlay}
                    >
                        <Confetti active colors={burst.colors} />
                    </View>
                ) : null}
            </View>
        </ConfettiOverlayContext.Provider>
    );
}

export function useConfettiOverlay(): ConfettiOverlayValue {
    const value = useContext(ConfettiOverlayContext);
    if (!value) throw new Error('useConfettiOverlay() must be used within <ConfettiOverlayProvider>.');
    return value;
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
});
