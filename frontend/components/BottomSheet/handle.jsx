import React, { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme, Appbar } from "react-native-paper";
import SheetHeader from './header';
import ContentsSearchBar from './contents-search-bar';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const ANGLE_30 = Math.PI / 6;

const transformOrigin = ({ x, y }, ...transformations) => {
  "worklet";
  return [
    { translateX: x },
    { translateY: y },
    ...transformations,
    { translateX: x * -1 },
    { translateY: y * -1 },
  ];
};

const Handle = ({
  style,
  animatedIndex,
  haptics = true,
  useSolidBackground = false,
  variant = 'standard', // 'standard' | 'compact'
  title,
  showClose = true,
  closeIcon = 'close',
  onClose,
  onLayout,
  textColor,
  // header props for standard variant
  headerComponent,
  headerActionLabel,
  onHeaderActionPress,
  headerChildren,
  // search props for standard variant
  enableSearch = false,
  searchPlaceholder,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  searchResetKey,
  ...restProps
}) => {
  const hasFiredRef = useRef(false);
  const theme = useTheme();
  const colors = theme?.colors ?? {};
  const [searchValue, setSearchValue] = useState('');
  const lastResetKeyRef = useRef(searchResetKey);

  useEffect(() => {
    if (!enableSearch || (typeof searchResetKey === 'number' && searchResetKey !== lastResetKeyRef.current)) {
      setSearchValue('');
      lastResetKeyRef.current = searchResetKey;
    }
  }, [enableSearch, searchResetKey]);

  const handleSearchChange = useCallback((text) => {
    setSearchValue(text);
    onSearchChange?.(text);
  }, [onSearchChange]);

  const fireHaptic = useCallback(() => {
    if (haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [haptics]);

  // animations
  const indicatorTransformOriginY = useDerivedValue(() =>
    interpolate(animatedIndex.value, [0, 1], [-1, 0], Extrapolate.CLAMP)
  );

  const backgroundColor = useMemo(() => {
    if (useSolidBackground || variant === 'standard') {
      return colors.surface ?? colors.background ?? '#444';
    }
    return 'transparent';
  }, [useSolidBackground, variant, colors.surface, colors.background]);

  const containerStyle = useMemo(
    () => [
      styles.header,
      variant === 'standard' ? styles.standardHandle : styles.compactHandleWrapper,
      { backgroundColor },
      style,
    ],
    [style, backgroundColor, variant]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const borderTopRadius = interpolate(
      animatedIndex.value,
      [0, 1],
      [20, 0],
      Extrapolate.CLAMP
    );
    return {
      borderTopLeftRadius: borderTopRadius,
      borderTopRightRadius: borderTopRadius,
    };
  });

  const leftIndicatorStyle = [styles.indicator, styles.leftIndicator];
  const rightIndicatorStyle = [styles.indicator, styles.rightIndicator];
  
  const leftIndicatorAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(animatedIndex.value, [0, 1], [-ANGLE_30, 0], Extrapolate.CLAMP);
    return {
      transform: transformOrigin(
        { x: 0, y: indicatorTransformOriginY.value },
        { rotate: `${rotation}rad` },
        { translateX: -5 }
      ),
    };
  });

  const rightIndicatorAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(animatedIndex.value, [0, 1], [ANGLE_30, 0], Extrapolate.CLAMP);
    return {
      transform: transformOrigin(
        { x: 0, y: indicatorTransformOriginY.value },
        { rotate: `${rotation}rad` },
        { translateX: 5 }
      ),
    };
  });

  const onTouchStart = useCallback(() => {
    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      fireHaptic();
    }
  }, [fireHaptic]);

  const onTouchEnd = useCallback(() => {
    hasFiredRef.current = false;
  }, []);

  const handlePressClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  const shouldRenderHeader = variant === 'standard' && (title || headerComponent || headerActionLabel || headerChildren || showClose);
  const shouldRenderSearch = variant === 'standard' && enableSearch;
  const searchPlaceholderText = searchPlaceholder ?? 'Search';

  const renderedHeader = useMemo(() => {
    if (variant !== 'standard' || !shouldRenderHeader) return null;
    if (headerComponent) return headerComponent;
    return (
      <SheetHeader
        title={title}
        actionLabel={headerActionLabel}
        onActionPress={onHeaderActionPress}
        showClose={showClose}
        onClose={onClose}
        closeIcon={closeIcon}
        textColor={textColor}
      >
        {headerChildren}
      </SheetHeader>
    );
  }, [variant, shouldRenderHeader, headerComponent, title, headerActionLabel, onHeaderActionPress, showClose, onClose, closeIcon, headerChildren]);

  if (variant === 'compact') {
    return (
      <Animated.View
        {...restProps}
        style={[containerStyle, containerAnimatedStyle]}
        onLayout={onLayout}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Animated.View style={styles.compactWrapper} pointerEvents="box-none">
          <Appbar.Header
            statusBarHeight={0}
            style={styles.compactAppbar}
          >
            {title ? (
              <Appbar.Content title={title} titleStyle={[styles.compactTitle, { color: textColor || colors.text || colors.onSurface || '#fff' }]} />
            ) : null}
            {showClose ? (
              <Appbar.Action
                icon={closeIcon}
                accessibilityLabel={'Close'}
                onPress={handlePressClose}
                rippleColor={colors.backdrop}
              />
            ) : null}
          </Appbar.Header>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...restProps}
      style={[containerStyle, containerAnimatedStyle]}
      onLayout={onLayout}
      renderToHardwareTextureAndroid
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <View style={styles.indicatorWrapper}>
        <Animated.View style={[leftIndicatorStyle, leftIndicatorAnimatedStyle, { backgroundColor: colors.buttonBackground || colors.outline || '#999' }]} />
        <Animated.View style={[rightIndicatorStyle, rightIndicatorAnimatedStyle, { backgroundColor: colors.buttonBackground || colors.outline || '#999' }]} />
      </View>
      {shouldRenderHeader && (
        <View style={styles.headerContainer} pointerEvents="box-none">
          {renderedHeader}
        </View>
      )}
      {shouldRenderSearch && (
        <View style={styles.searchContainer} pointerEvents="box-none">
          <ContentsSearchBar
            value={searchValue}
            onChangeText={handleSearchChange}
            placeholder={searchPlaceholderText}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
          />
        </View>
      )}
    </Animated.View>
  );
};

  export default React.memo(Handle);

const styles = StyleSheet.create({
  header: {
    alignContent: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  standardHandle: {
    paddingTop: 14,
    paddingBottom: 0,
    width: '100%',
  },
  indicatorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 14,
    width: '100%',
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 12,
  },
  searchContainer: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  compactHandleWrapper: {
    paddingTop: 4,
    width: '100%',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  compactAppbar: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    width: '100%',
    height: 44,
    minHeight: 44,
  },
  compactWrapper: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  compactTitle: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  indicator: {
    position: "absolute",
    width: 10,
    height: 4,
  },
  leftIndicator: {
    borderTopStartRadius: 2,
    borderBottomStartRadius: 2,
  },
  rightIndicator: {
    borderTopEndRadius: 2,
    borderBottomEndRadius: 2,
  },
});