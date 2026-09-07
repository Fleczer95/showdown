import React from 'react';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Sparkles } from 'lucide-react-native';
import Icon from '../../components/atoms/Icon';
import { blend, darken } from '../../theme/colorUtils';
import type { EventEdition } from '../../../shared/events/definitions';

/** Original decorative vector; the containing button owns the complete touch target. */
export function EventArtwork({
    artwork,
    accent,
    size,
}: {
    artwork: EventEdition['artwork'];
    accent: string;
    size: number;
}) {
    if (artwork !== 'pumpkin') return <Icon name={Sparkles} size={size} color={accent} />;
    const shadow = darken(accent, 0.2);
    const ink = darken(accent, 0.85);
    return (
        <Svg width={size} height={size} viewBox='0 0 76 76' accessible={false}>
            <Path d='M35 23 C32 16 36 7 43 5 L47 10 C41 12 40 18 42 23Z' fill='#75A65A' />
            <Path d='M41 18 C48 7 59 12 60 17 C52 22 46 23 41 18Z' fill='#91BD76' />
            <Ellipse cx='24' cy='45' rx='20' ry='25' fill={shadow} />
            <Ellipse cx='52' cy='45' rx='20' ry='25' fill={shadow} />
            <Ellipse cx='30' cy='45' rx='19' ry='26' fill={accent} />
            <Ellipse cx='46' cy='45' rx='19' ry='26' fill={accent} />
            <Ellipse cx='38' cy='45' rx='13' ry='27' fill={blend('#FFFFFF', accent, 0.13)} />
            <Path d='M17 41 L28 32 L31 43Z M45 43 L48 32 L59 41Z M34 49 L38 43 L42 49Z' fill={ink} />
            <Path d='M17 50 L26 55 L29 52 L34 57 L39 54 L44 58 L49 53 L53 55 L60 49 C56 69 22 70 17 50Z' fill={ink} />
        </Svg>
    );
}
