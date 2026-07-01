jest.mock('react-native-mmkv', () => ({
    createMMKV: jest.fn(() => ({
        getString: jest.fn(),
        getBoolean: jest.fn(),
        getNumber: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        addOnValueChangedListener: jest.fn(() => ({
            remove: jest.fn(),
        })),
    })),
}));

jest.mock('expo-localization', () => ({
    getLocales: () => [{ languageCode: 'en' }],
    locale: 'en',
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
}));

jest.mock('@shopify/react-native-skia', () => ({
    Canvas: ({ children }) => children,
    Circle: () => null,
    Rect: () => null,
    Path: () => null,
    Group: ({ children }) => children,
    Text: () => null,
    useFont: () => ({}),
    matchFont: () => ({}),
    vec: (x, y) => ({ x, y }),
    rect: (x, y, w, h) => ({ x, y, w, h }),
    Skia: {
        Path: {
            Make: () => ({}),
        },
    },
}));

jest.mock('expo-system-ui', () => ({
    setBackgroundColorAsync: jest.fn(),
}));

jest.mock('react-native-iap', () => ({
    initConnection: jest.fn(() => Promise.resolve(true)),
    endConnection: jest.fn(() => Promise.resolve()),
    getProducts: jest.fn(() => Promise.resolve([])),
    requestPurchase: jest.fn(() => Promise.resolve()),
    getAvailablePurchases: jest.fn(() => Promise.resolve([])),
    useIAP: () => ({
        connected: true,
        products: [],
        promotedProductsIOS: [],
        subscriptions: [],
        purchaseHistories: [],
        availablePurchases: [],
        currentPurchase: null,
        currentPurchaseError: null,
        initConnection: jest.fn(),
        endConnection: jest.fn(),
        getProducts: jest.fn(),
        fetchProducts: jest.fn(() => Promise.resolve()),
        finishTransaction: jest.fn(() => Promise.resolve()),
        getSubscriptions: jest.fn(),
        getAvailablePurchases: jest.fn(),
        getPurchaseHistory: jest.fn(),
    }),
}));

jest.mock('react-native-nitro-modules', () => ({}));

jest.mock('@react-native-firebase/analytics', () => ({
    logEvent: jest.fn(),
    logScreenView: jest.fn(),
    setUserProperties: jest.fn(),
}));
