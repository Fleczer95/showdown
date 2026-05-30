import React from 'react';
import { GameSessionProvider } from './useGameSession';
import { useAppStateTracker } from './useAppStateTracker';
import { useUserPropertiesSync } from './useUserPropertiesSync';
import { useStoreAnalyticsBridge } from './useStoreAnalyticsBridge';
import { useSettingsAnalyticsBridge } from './useSettingsAnalyticsBridge';

function AnalyticsSideEffects(): null {
    useAppStateTracker();
    useUserPropertiesSync();
    useStoreAnalyticsBridge();
    useSettingsAnalyticsBridge();
    return null;
}

export function AnalyticsProviders({ children }: { children: React.ReactNode }) {
    return (
        <GameSessionProvider>
            <AnalyticsSideEffects />
            {children}
        </GameSessionProvider>
    );
}
