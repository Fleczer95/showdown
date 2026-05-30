import React from 'react';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideInUp,
    SlideInLeft,
    SlideInRight,
    SlideOutDown,
    SlideOutUp,
    SlideOutLeft,
    SlideOutRight,
    LinearTransition,
    ZoomIn,
    ZoomOut,
    Layout,
} from 'react-native-reanimated';

type EnterPreset = 'fadeIn' | 'slideInDown' | 'slideInUp' | 'slideInLeft' | 'slideInRight' | 'zoomIn';
type ExitPreset = 'fadeOut' | 'slideOutDown' | 'slideOutUp' | 'slideOutLeft' | 'slideOutRight' | 'zoomOut';
type LayoutPreset = 'spring' | 'linear';

// Use `as any` for the animation builder return types to avoid
// version-specific Reanimated generic constraints
const enterPresets = {
    fadeIn: FadeIn.duration(250),
    slideInDown: SlideInDown.springify().damping(20).stiffness(150),
    slideInUp: SlideInUp.springify().damping(20).stiffness(150),
    slideInLeft: SlideInLeft.springify().damping(20).stiffness(150),
    slideInRight: SlideInRight.springify().damping(20).stiffness(150),
    zoomIn: ZoomIn.duration(200),
};

const exitPresets = {
    fadeOut: FadeOut.duration(200),
    slideOutDown: SlideOutDown.duration(250),
    slideOutUp: SlideOutUp.duration(250),
    slideOutLeft: SlideOutLeft.duration(250),
    slideOutRight: SlideOutRight.duration(250),
    zoomOut: ZoomOut.duration(150),
};

const layoutPresets = {
    spring: Layout.springify().damping(15).stiffness(120),
    linear: LinearTransition.duration(250),
};

export interface TransitionProps {
    children: React.ReactNode;
    entering?: EnterPreset;
    exiting?: ExitPreset;
    layout?: LayoutPreset;
    style?: Animated.View['props']['style'];
    testID?: string;
}

function Transition({ children, entering = 'fadeIn', exiting = 'fadeOut', layout, style, testID }: TransitionProps) {
    return (
        <Animated.View
            entering={enterPresets[entering] as never}
            exiting={exitPresets[exiting] as never}
            {...(layout ? { layout: layoutPresets[layout] as never } : {})}
            style={style}
            testID={testID}
        >
            {children}
        </Animated.View>
    );
}

export default React.memo(Transition);

// Export presets for direct use
export { enterPresets as enterMap, exitPresets as exitMap, layoutPresets as layoutMap };
