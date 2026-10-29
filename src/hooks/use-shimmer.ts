'use no memo';

import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Skeleton shimmer — mirror web `.skeleton` keyframes (globals.css):
 * opacity 0.4 → 0.8 → 0.4, 1.5s ease-in-out infinite.
 *
 * 'use no memo': React Compiler DEV freeze giá trị ref (Animated.Value)
 * → RN ghi property `_tracking` mới khi start animation → TypeError
 * "Cannot add new property '_tracking'". Opt-out khỏi compiler.
 * Instance ổn định qua lazy useState (không dùng useRef().current trong render).
 */
export function useShimmer(): Animated.Value {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return opacity;
}