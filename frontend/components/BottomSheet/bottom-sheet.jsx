import React, { useCallback, useMemo, useRef, useEffect, useState, useImperativeHandle } from 'react';
import { StyleSheet, Dimensions, Keyboard, Platform } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Backdrop from './backdrop';
import Footer from './footer';
import Background from './background';
import Handle from './handle';
import Contents from './contents';
import {
  calculateMaxSheetHeight,
  getMaxIndex,
  getSnapPoints,
  getInitialIndex,
  calculateAdjustedMaxContentSize
} from './utils';
import { ScrollView } from 'react-native-gesture-handler';

const CustomBottomSheetInner = (props, ref) => {
  const {
    // Core props
    onChange,
    onClose,
    variant = 'standard',
    snapPoints: customSnapPoints,
    initialIndex: customInitialIndex,
    enableDynamicSizing: enableDynamicSizingProp = true,
    maxDynamicContentSize: maxDynamicContentSizeProp,
    containerStyle: overrideContainerStyle,
    
    // Header configuration
    header = {},
    
    // Search configuration
    search = {},
    
    // Footer configuration
    footer = {},
    
  // List configuration
    data = [],
    renderItem,
    keyExtractor,
    getItem,
    getItemCount,
    onItemPress,
    itemTitleExtractor,
    emptyComponent,
    
    // Custom content (alternative to list)
    customContent,
    children,
    
    ...restProps
  } = props;

  // Destructure nested configs with defaults
  const {
    title = header.title,
    component: headerComponent = header.component,
    actionLabel: headerActionLabel = header.actionLabel,
    onActionPress: onHeaderActionPress = header.onActionPress,
    showClose = header.showClose ?? true,
    closeIcon = header.closeIcon ?? 'close',
    solidBackground: handleSolidBackground = header.solidBackground ?? false,
    children: headerChildren = header.children,
    textColor: headerTextColor = header.textColor,
  } = header;

  const {
    enabled: enableSearch = search.enabled ?? false,
    placeholder: searchPlaceholder = search.placeholder,
    position: searchPosition = search.position ?? 'top',
    autoExpandOnFocus: autoExpandOnSearchFocus = search.autoExpandOnFocus ?? true,
    autoExpandOnKeyboard: autoExpandOnKeyboardShow = search.autoExpandOnKeyboard ?? true,
  } = search;

  const {
    variant: footerVariant = footer.variant ?? 'default',
    placement: footerPlacement = footer.placement ?? 'right',
  } = footer;

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = insets?.top ?? 0;
  const bottomInset = insets?.bottom ?? 0;
  const windowHeight = useMemo(() => Dimensions.get('window').height, []);
  
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const bottomSheetRef = useRef(null);
  const currentIndexRef = useRef(null);

  const maxSheetHeight = useMemo(() => 
    calculateMaxSheetHeight(windowHeight, topInset),
    [windowHeight, topInset]
  );

  const enableDynamicSizing = enableDynamicSizingProp;

  const snapPoints = useMemo(() => 
    getSnapPoints(enableDynamicSizing, customSnapPoints),
    [enableDynamicSizing, customSnapPoints]
  );

  const initialIndex = useMemo(() => 
    getInitialIndex(enableDynamicSizing, customInitialIndex, snapPoints.length),
    [enableDynamicSizing, customInitialIndex, snapPoints.length]
  );

  const maxDynamicContentSize = useMemo(() => 
    typeof maxDynamicContentSizeProp === 'number'
      ? Math.min(maxDynamicContentSizeProp, maxSheetHeight)
      : maxSheetHeight,
    [maxDynamicContentSizeProp, maxSheetHeight]
  );

  const adjustedMaxContentSize = useMemo(() => 
    calculateAdjustedMaxContentSize(keyboardHeight, maxDynamicContentSize, topInset, bottomInset, windowHeight),
    [keyboardHeight, maxDynamicContentSize, topInset, bottomInset, windowHeight]
  );

  const lastIndex = useMemo(() => 
    getMaxIndex(enableDynamicSizing, snapPoints.length),
    [enableDynamicSizing, snapPoints.length]
  );

  useEffect(() => {
    currentIndexRef.current = initialIndex;
  }, [initialIndex]);

  const clearSearchState = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setSearchResetKey((prev) => prev + 1);
  }, []);

  const handleSheetChanges = useCallback((index) => {
    currentIndexRef.current = index;
    if (index === -1 || index === 0) {
      if (index === -1) clearSearchState();
      Keyboard.dismiss();
    }
    onChange?.(index);
  }, [clearSearchState, onChange]);

  const handleClose = useCallback(() => {
    clearSearchState();
    if (typeof onClose === 'function') return onClose();
    bottomSheetRef.current?.close?.();
  }, [clearSearchState, onClose]);

  const expandToMax = useCallback(() => {
    bottomSheetRef.current?.snapToIndex?.(getMaxIndex(enableDynamicSizing, snapPoints.length));
  }, [enableDynamicSizing, snapPoints.length]);

  const handleSearchFocus = useCallback(() => {
    setSearchActive(true);
    if (autoExpandOnSearchFocus) expandToMax();
  }, [autoExpandOnSearchFocus, expandToMax]);

  const handleSearchBlur = useCallback(() => {
    setSearchActive(false);
  }, []);

  const handleBackdropPress = useCallback(() => {
    if (searchActive) {
      Keyboard.dismiss();
      setSearchActive(false);
      return;
    }
    bottomSheetRef.current?.snapToIndex?.(0);
  }, [searchActive]);

  const showSearchInHandle = useMemo(() => 
    enableSearch && searchPosition === 'top',
    [enableSearch, searchPosition]
  );

  const showSearchInFooter = useMemo(() => 
    enableSearch && searchPosition === 'bottom',
    [enableSearch, searchPosition]
  );

  const effectiveFooterVariant = useMemo(() => 
    showSearchInFooter ? 'search' : footerVariant,
    [showSearchInFooter, footerVariant]
  );

  // Consolidated handle props
  const handleProps = useMemo(() => ({
    variant,
    title: variant === 'compact' ? title : (variant === 'standard' ? title : undefined),
    showClose,
    closeIcon,
    lastIndex,
    onClose: handleClose,
    useSolidBackground: handleSolidBackground,
    headerComponent: variant === 'standard' ? headerComponent : undefined,
    headerActionLabel: variant === 'standard' ? headerActionLabel : undefined,
    onHeaderActionPress: variant === 'standard' ? onHeaderActionPress : undefined,
    headerChildren: variant === 'standard' ? headerChildren : undefined,
    enableSearch: variant === 'standard' ? showSearchInHandle : false,
    searchPlaceholder,
    onSearchChange: setSearchQuery,
    onSearchFocus: handleSearchFocus,
    onSearchBlur: handleSearchBlur,
    searchResetKey,
    textColor: headerTextColor,
  }), [variant, title, showClose, closeIcon, lastIndex, handleClose, handleSolidBackground, 
      headerComponent, headerActionLabel, onHeaderActionPress, headerChildren, showSearchInHandle, 
      searchPlaceholder, handleSearchFocus, handleSearchBlur, searchResetKey, headerTextColor]);

  // Consolidated footer props
  const footerProps = useMemo(() => ({
    lastIndex,
    variant: effectiveFooterVariant,
    placement: footerPlacement,
    searchValue: showSearchInFooter ? searchQuery : '',
    onSearchChange: showSearchInFooter ? setSearchQuery : undefined,
    searchPlaceholder: showSearchInFooter ? searchPlaceholder : undefined,
    onSearchFocus: showSearchInFooter ? handleSearchFocus : undefined,
    onSearchBlur: showSearchInFooter ? handleSearchBlur : undefined,
  }), [lastIndex, effectiveFooterVariant, footerPlacement, showSearchInFooter, searchQuery, 
      searchPlaceholder, handleSearchFocus, handleSearchBlur]);

  const renderHandle = useCallback(
    (props) => <Handle {...props} {...handleProps} />,
    [handleProps]
  );

  const renderBackdrop = useCallback(
    (backdropProps) => (
      <Backdrop
        animatedIndex={backdropProps.animatedIndex}
        style={backdropProps.style}
        onPress={handleBackdropPress}
      />
    ),
    [handleBackdropPress]
  );

  const renderFooter = useCallback(
    (props) => <Footer {...props} {...footerProps} />,
    [footerProps]
  );

  const renderBackground = useCallback(
    (backgroundProps) => <Background {...backgroundProps} />,
    []
  );

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.snapToIndex?.(lastIndex),
    collapse: () => bottomSheetRef.current?.snapToIndex?.(0),
    close: () => bottomSheetRef.current?.close?.(),
    forceClose: () => bottomSheetRef.current?.forceClose?.(),
    snapToIndex: (index) => {
      if (typeof index !== 'number') return;
      bottomSheetRef.current?.snapToIndex?.(Math.max(0, Math.min(index, lastIndex)));
    },
    snapToPosition: (position) => bottomSheetRef.current?.snapToPosition?.(position),
    getCurrentIndex: () => currentIndexRef.current ?? initialIndex,
  }), [lastIndex, initialIndex]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      
      if (autoExpandOnKeyboardShow && bottomSheetRef.current) {
        setTimeout(() => bottomSheetRef.current?.snapToIndex?.(1), 50);
      }
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [autoExpandOnKeyboardShow]);

  const effectiveBottomInset = keyboardHeight > 0 ? keyboardHeight : 0;
  const bottomPadding = bottomInset + 8;
  const footerComponentProp = footerVariant === 'none' ? undefined : renderFooter;

  const combinedContainerStyle = useMemo(() => {
    const shadowColor = theme.colors?.shadow || '#000';
    const base = [styles.shadows, { shadowColor }];
    return overrideContainerStyle ? [...base, overrideContainerStyle] : base;
  }, [theme.colors?.shadow, overrideContainerStyle]);

  const resolvedCustomContent = customContent ?? children;
  const hasCustomContent = resolvedCustomContent !== undefined && resolvedCustomContent !== null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={handleSheetChanges}
      index={initialIndex}
      snapPoints={snapPoints}
      enableOverDrag={false}
      topInset={topInset}
      bottomInset={effectiveBottomInset}
      enableDynamicSizing={enableDynamicSizing}
      maxDynamicContentSize={adjustedMaxContentSize}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enablePanDownToClose
      handleComponent={renderHandle}
      backdropComponent={renderBackdrop}
      footerComponent={footerComponentProp}
      backgroundComponent={renderBackground}
      containerStyle={combinedContainerStyle}
      {...restProps}
    >
      {hasCustomContent ? (
        <BottomSheetView
          style={{ flex: 1, paddingHorizontal: 16, paddingBottom: bottomPadding + 40, paddingTop: 12 }}
        >
          <ScrollView style={{}}>
          {resolvedCustomContent}
          </ScrollView>
        </BottomSheetView>
      ) : (
        <Contents
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItem={getItem}
          getItemCount={getItemCount}
          onItemPress={onItemPress}
          itemTitleExtractor={itemTitleExtractor}
          theme={theme}
          emptyComponent={emptyComponent}
          extraBottomPadding={bottomPadding + 40}
          enableSearch={enableSearch}
          searchQuery={searchQuery}
          textColor={headerTextColor}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  shadows: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
});

const ForwardedCustomBottomSheet = React.forwardRef(CustomBottomSheetInner);

ForwardedCustomBottomSheet.displayName = 'CustomBottomSheet';

export default React.memo(ForwardedCustomBottomSheet);