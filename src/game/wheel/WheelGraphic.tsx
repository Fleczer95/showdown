import React from 'react';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { WHEEL } from './logic';
import { useTheme } from '../../theme';
import { darken, readableOn } from '../../theme/colorUtils';

const DEFAULT_SIZE = 240;
const SEG = 360 / WHEEL.length;

/** Point on the wheel at `deg` (clockwise from the top pointer) and `radius`. */
function pointAt(deg: number, radius: number, cx: number, cy: number): [number, number] {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.sin(rad), cy - radius * Math.cos(rad)];
}

/**
 * The wheel face: alternating accent-tinted pie segments with bankrupt slices in
 * the error color. Drawn statically — the parent Animated.View handles spin
 * rotation. Geometry matches `logic.ts`'s landing math (segment i is centered at
 * SEG·i clockwise from the top pointer).
 */
function WheelGraphic({ accent, size = DEFAULT_SIZE }: { accent: string; size?: number }) {
    const t = useTheme();
    const onAccent = readableOn(accent);
    const accentDark = darken(accent, 0.32);

    const R = size / 2;
    const RIM = R - 3;
    const scale = size / DEFAULT_SIZE;

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {WHEEL.map((seg, i) => {
                const center = SEG * i;
                const [x0, y0] = pointAt(center - SEG / 2, RIM, R, R);
                const [x1, y1] = pointAt(center + SEG / 2, RIM, R, R);
                const [lx, ly] = pointAt(center, RIM * 0.68, R, R);
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
                            fontSize={13 * scale}
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
            <Circle cx={R} cy={R} r={size > 300 ? 36 : 26} fill={t.colors.surface} stroke={accent} strokeWidth={3} />
            <Circle cx={R} cy={R} r={size > 300 ? 8 : 6} fill={accent} />
        </Svg>
    );
}

export default React.memo(WheelGraphic);
