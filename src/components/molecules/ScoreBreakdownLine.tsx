import React from 'react';
import Text from '../atoms/Text';
import { useTranslation } from '../../i18n/TranslationContext';
import type { ScoreBreakdown } from '../../game/scoring';

/**
 * A single caption line showing where a game-over score came from, e.g.
 * "Base 4,500 · Speed +320 · Bonus +1,000". Speed and bonus segments are
 * omitted when zero, so a plain run reads simply "Base 4,500".
 */
function ScoreBreakdownLine({ breakdown }: { breakdown: ScoreBreakdown }) {
    const { t, locale } = useTranslation();
    const fmt = (n: number) => n.toLocaleString(locale);

    const parts = [`${t('leaderboard.base')} ${fmt(breakdown.base)}`];
    if (breakdown.speed > 0) parts.push(`${t('leaderboard.speed')} +${fmt(breakdown.speed)}`);
    if (breakdown.bonus > 0) parts.push(`${t('leaderboard.bonus')} +${fmt(breakdown.bonus)}`);

    return (
        <Text variant='caption' color='textMuted' align='center'>
            {parts.join('  ·  ')}
        </Text>
    );
}

export default React.memo(ScoreBreakdownLine);
