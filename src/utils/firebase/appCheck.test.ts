const mockConfigure = jest.fn();
const mockInitialize = jest.fn();
const mockProvider = jest.fn(() => ({ configure: mockConfigure }));

jest.mock('@react-native-firebase/app-check', () => ({
    __esModule: true,
    default: () => ({
        newReactNativeFirebaseAppCheckProvider: mockProvider,
        initializeAppCheck: mockInitialize,
    }),
}));

const mockCapture = jest.fn();
jest.mock('../sentry/init', () => ({
    SafeSentry: { captureException: (...args: unknown[]) => mockCapture(...args) },
}));

import { initAppCheck } from './appCheck';

beforeEach(() => {
    jest.clearAllMocks();
    mockInitialize.mockResolvedValue(undefined);
});

describe('initAppCheck', () => {
    it('configures the production hardware providers before initializing', async () => {
        await expect(initAppCheck()).resolves.toBe(true);

        expect(mockConfigure).toHaveBeenCalledWith({
            android: { provider: 'playIntegrity' },
            apple: { provider: 'appAttestWithDeviceCheckFallback' },
        });
        expect(mockInitialize).toHaveBeenCalledWith({
            provider: expect.objectContaining({ configure: mockConfigure }),
            isTokenAutoRefreshEnabled: true,
        });
        expect(mockCapture).not.toHaveBeenCalled();
    });

    it('reports initialization failure without rejecting app startup', async () => {
        const error = new Error('App Attest unavailable');
        mockInitialize.mockRejectedValue(error);

        await expect(initAppCheck()).resolves.toBe(false);
        expect(mockCapture).toHaveBeenCalledWith(error, {
            tags: { area: 'app-check', stage: 'initialize' },
        });
    });
});
