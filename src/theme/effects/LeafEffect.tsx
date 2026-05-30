import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    useDerivedValue,
    cancelAnimation,
    Easing,
    type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../context';

const LEAF_COUNT = 15;
const LEAF_PATH = 'M 10 0 C 15 5 20 15 10 25 C 0 15 5 5 10 0'; // Simple leaf shape

interface LeafProps {
    particle: {
        x: number;
        y: number;
        size: number;
        speed: number;
        rotation: number;
        rotSpeed: number;
        swing: number;
        swingSpeed: number;
    };
    time: SharedValue<number>;
    path: any;
    width: number;
    height: number;
    color: string;
}

const Leaf = ({ particle, time, path, width, height, color }: LeafProps) => {
    const matrix = useDerivedValue(() => {
        const tVal = time.value * 10000;
        const y = ((particle.y + tVal * particle.speed) % (height + 100)) - 50;
        const x = (particle.x + Math.sin(tVal * particle.swingSpeed) * particle.swing) % width;
        const rotation = particle.rotation + tVal * particle.rotSpeed;
        const scale = particle.size / 25;

        const m = Skia.Matrix();
        m.translate(x, y);
        m.rotate(rotation);
        m.scale(scale, scale);
        return m;
    });

    return <Path path={path} matrix={matrix} color={color} />;
};

export const LeafEffect = () => {
    const { width, height } = useWindowDimensions();
    const t = useTheme();

    const path = useMemo(() => Skia.Path.MakeFromSVGString(LEAF_PATH)!, []);

    const particles = useMemo(() => {
        return Array.from({ length: LEAF_COUNT }).map(() => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: 12 + Math.random() * 18,
            speed: 0.05 + Math.random() * 0.1,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.002,
            swing: 20 + Math.random() * 40,
            swingSpeed: 0.0002 + Math.random() * 0.0004,
        }));
    }, [width, height]);

    const time = useSharedValue(0);

    React.useEffect(() => {
        time.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false);
        return () => cancelAnimation(time);
    }, [time]);

    return (
        <Group opacity={0.4}>
            {particles.map((p, i) => (
                <Leaf
                    key={i}
                    particle={p}
                    time={time}
                    path={path}
                    width={width}
                    height={height}
                    color={t.colors.primary}
                />
            ))}
        </Group>
    );
};
