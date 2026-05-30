import { useCallback } from 'react';
import { createAudioPlayer } from 'expo-audio';
import { useSettings } from './useSettings';

// Reused for the app's lifetime to avoid re-decoding the asset on every play.
const players = {
    correct: createAudioPlayer(require('../../assets/sounds/correct.mp3')),
    wrong: createAudioPlayer(require('../../assets/sounds/wrong.mp3')),
    timeUp: createAudioPlayer(require('../../assets/sounds/time-up.mp3')),
};

export type SoundName = keyof typeof players;

export const useSound = () => {
    const { soundEffects: enabled } = useSettings();

    const play = useCallback(
        (name: SoundName) => {
            if (!enabled) return;
            const player = players[name];
            player.seekTo(0);
            player.play();
        },
        [enabled],
    );

    return { play };
};
