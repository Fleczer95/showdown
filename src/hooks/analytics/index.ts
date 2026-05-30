export { SafeAnalytics, initFirebase } from '../../utils/firebase/init';
export { mapErrorToCategory, safeErrorCode } from '../../utils/firebase/errors';
export { AnalyticsProviders } from './AnalyticsProviders';
export { GameSessionProvider, useGameSession } from './useGameSession';
export { useAppStateTracker } from './useAppStateTracker';
export { useUserPropertiesSync, markFirstGameCompleted } from './useUserPropertiesSync';
export { useStoreAnalyticsBridge } from './useStoreAnalyticsBridge';
export { useSettingsAnalyticsBridge } from './useSettingsAnalyticsBridge';
// Per-game analytics bridges (Ladder, Grid, Opinion Poll, Wheel) are added during the game-logic phase.
export type { AnalyticsEvent, AnalyticsEventName, GameId, PurchaseErrorCategory } from '../../utils/firebase/events';
