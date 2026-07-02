describe('equipped mascot look', () => {
    it('normalizes persisted data to the four known slots', () => {
        jest.isolateModules(() => {
            const store = {
                getString: jest.fn(() =>
                    JSON.stringify({
                        fur: 'fur.future',
                        suit: 'suit.future',
                        accent: 'accent.future',
                        mic: 'mic.future',
                        cape: 'cape.future',
                    }),
                ),
                set: jest.fn(),
            };
            jest.doMock('react-native-mmkv', () => ({ createMMKV: () => store }));

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getEquippedLook } = require('./equippedLook');

            expect(getEquippedLook()).toEqual({
                fur: 'fur.future',
                suit: 'suit.future',
                accent: 'accent.future',
                mic: 'mic.future',
            });
        });
    });
});
