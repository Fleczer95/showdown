import React from 'react';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { WHEEL } from './logic';
import { useTheme } from '../../theme';
import { darken, readableOn } from '../../theme/colorUtils';

const SIZE = 240;
const R = SIZE / 2;
const RIM = R - 3;
const SEG = 360 / WHEEL.length;

/** Point on the wheel at `deg` (clockwise from the top pointer) and `radius`. */
function pointAt(deg: number, radius: number): [number, number] {
    const rad = (deg * Math.PI) / 180;
    return [R + radius * Math.sin(rad), R - radius * Math.cos(rad)];
}

/**
 * The wheel face: alternating accent-tinted pie segments with bankrupt slices in
 * the error color. Drawn statically — the parent Animated.View handles spin
 * rotation. Geometry matches `logic.ts`'s landing math (segment i is centered at
 * SEG·i clockwise from the top pointer).
 */
function WheelGraphic({ accent }: { accent: string }) {
    const t = useTheme();
    const onAccent = readableOn(accent);
    const accentDark = darken(accent, 0.32);

    return (
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {WHEEL.map((seg, i) => {
                const center = SEG * i;
                const [x0, y0] = pointAt(center - SEG / 2, RIM);
                const [x1, y1] = pointAt(center + SEG / 2, RIM);
                const [lx, ly] = pointAt(center, RIM * 0.68);
                const fill = seg.bankrupt ? t.colors.error : i % 2 === 0 ? accent : accentDark;
                const textColor = seg.bankrupt ? '#FFFFFF' : onAccent;
                return (
                    <G key={i}>
                        <Path
                            d={`M ${R} ${R} L ${x0} ${y0} A ${RIM} ${RIM} 0 0 1 ${x1} ${y1} Z`}
                            fill={fill}
                            stroke={t.colors.surface}
                            strokeWidth={1.5}
                        />
                        <SvgText
                            x={lx}
                            y={ly}
                            fill={textColor}
                            fontSize={13}
                            fontWeight='bold'
                            textAnchor='middle'
                            alignmentBaseline='middle'
                            transform={`rotate(${center}, ${lx}, ${ly})`}
                        >
                            {seg.bankrupt ? '✕' : seg.label}
                        </SvgText>
                    </G>
                );
            })}
            {/* Outer rim + center hub */}
            <Circle cx={R} cy={R} r={RIM} fill='none' stroke={accent} strokeWidth={4} />
            <Circle cx={R} cy={R} r={26} fill={t.colors.surface} stroke={accent} strokeWidth={3} />
            <Circle cx={R} cy={R} r={6} fill={accent} />
        </Svg>
    );
}

export default React.memo(WheelGraphic);
