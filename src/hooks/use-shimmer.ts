import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Skeleton shimmer — mirror web `.skeleton` keyframes (globals.css):
 * opacity 0.4 → 0.8 → 0.4, 1.5s ease-in-out infinite.
 *
 * Trả về Animated.Value để đặt vào style của Animated.View skeleton.
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
