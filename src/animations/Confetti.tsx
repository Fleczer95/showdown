import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Skia, Picture } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useTheme } from '../theme';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    shape: 'rect' | 'circle';
    life: number;
    maxLife: number;
}

export interface ConfettiProps {
    /** Whether confetti is active */
    active: boolean;
    /** Duration in ms (default 3000) */
    duration?: number;
    /** Number of particles (default 80) */
    count?: number;
    /** Custom colors (defaults to theme primary/secondary/error) */
    colors?: string[];
    testID?: string;
}

const GRAVITY = 0.15;
const FRICTION = 0.99;

function createParticles(count: number, width: number, height: number, colors: string[]): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 4 + Math.random() * 8;
        particles.push({
            x: width / 2,
            y: height * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4,
            size: 4 + Math.random() * 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            shape: Math.random() > 0.5 ? 'rect' : 'circle',
            life: 1,
            maxLife: 60 + Math.random() * 60,
        });
    }
    return particles;
}

function recordPicture(particles: Particle[]): SkPicture | null {
    if (particles.length === 0) return null;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording();
    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    for (const p of particles) {
        paint.setColor(Skia.Color(p.color));
        paint.setAlphaf(Math.max(0, p.life));

        canvas.save();
        canvas.translate(p.x, p.y);
        canvas.rotate(p.rotation, 0, 0);

        if (p.shape === 'rect') {
            canvas.drawRect(Skia.XYWHRect(-p.size / 2, -p.size / 4, p.size, p.size / 2), paint);
        } else {
            canvas.drawCircle(0, 0, p.size / 2, paint);
        }

        canvas.restore();
    }

    return recorder.finishRecordingAsPicture();
}

function Confetti({ active, duration = 3000, count = 80, colors, testID }: ConfettiProps) {
    const { width, height } = useWindowDimensions();
    const t = useTheme();
    const [picture, setPicture] = useState<SkPicture | null>(null);
    const animatingRef = useRef(false);
    const rafRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);

    const tick = useCallback(() => {
        if (!animatingRef.current) return;

        const particles = particlesRef.current;
        for (const p of particles) {
            p.vy += GRAVITY;
            p.vx *= FRICTION;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.life -= 1 / p.maxLife;
        }

        // Filter out dead/offscreen
        const alive = particles.filter((p) => p.life > 0 && p.y < height + 20);
        particlesRef.current = alive;

        if (alive.length === 0) {
            animatingRef.current = false;
            setPicture(null);
            return;
        }

        // Record new Skia Picture — single draw call on canvas
        const pic = recordPicture(alive);
        setPicture(pic);

        rafRef.current = requestAnimationFrame(tick);
    }, [height]);

    useEffect(() => {
        const defaultColors = [t.colors.primary, t.colors.secondary, t.colors.error, t.colors.success];

        if (active) {
            particlesRef.current = createParticles(count, width, height, colors ?? defaultColors);
            animatingRef.current = true;
            setPicture(recordPicture(particlesRef.current));
            rafRef.current = requestAnimationFrame(tick);

            const timeout = setTimeout(() => {
                animatingRef.current = false;
            }, duration);

            return () => {
                clearTimeout(timeout);
                cancelAnimationFrame(rafRef.current);
                animatingRef.current = false;
            };
        } else {
            particlesRef.current = [];
            setPicture(null);
        }
    }, [active, duration, count, width, height, colors, t.colors, tick]);

    if (!active || !picture) return null;

    return (
        <View
            style={StyleSheet.absoluteFill}
            pointerEvents='none'
            testID={testID}
            importantForAccessibility='no-hide-descendants'
        >
            <Canvas style={StyleSheet.absoluteFill}>
                <Picture picture={picture} />
            </Canvas>
        </View>
    );
}

export default React.memo(Confetti);
