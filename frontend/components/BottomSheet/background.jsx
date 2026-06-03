import React, { useMemo } from "react";
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { useTheme } from 'react-native-paper';

const Background = ({ style, animatedIndex }) => {
  const theme = useTheme();
  const colors = theme?.colors ?? {};
  const endColor = colors.surface || colors.background || '#383838';
  const startColor = colors.focusedBackground || colors.surface || '#4c5063';

  const colorAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(animatedIndex.value, [0, 1], [startColor, endColor]),
  }), [startColor, endColor]);
  
  const radiusAnimatedStyle = useAnimatedStyle(() => {
    const r = interpolate(animatedIndex.value, [0, 1], [20, 0], Extrapolate.CLAMP);
    return {
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      overflow: 'hidden',
    };
  });

  const containerStyle = [colorAnimatedStyle, radiusAnimatedStyle, style].filter(Boolean);

  return <Animated.View pointerEvents="none" style={containerStyle} />;
};

export default React.memo(Background);