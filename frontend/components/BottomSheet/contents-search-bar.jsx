import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTheme, Icon, IconButton } from 'react-native-paper';

export const CONTENTS_SEARCH_BAR_BOTTOM_MARGIN = 8;

const ContentsSearchBar = ({ value, onChangeText, placeholder = 'Search', onFocus, onBlur, showShadow = false }) => {
  const theme = useTheme();
  const backgroundColor = theme.colors?.buttonBackgroundAlt || theme.colors?.surfaceVariant || '#494949';
  const textColor = theme.colors?.text || theme.colors?.onSurface || '#fff';
  const placeholderColor = theme.colors?.placeholderText || 'rgba(255,255,255,0.5)';
  const iconColor = theme.colors?.icon || textColor;

  const handleClear = useCallback(() => onChangeText?.(''), [onChangeText]);

  const containerStyle = [
    styles.searchbar,
    { backgroundColor },
    showShadow && styles.searchbarShadow,
  ];

  return (
    <View style={containerStyle}>
      <Icon source="magnify" size={20} color={iconColor} style={styles.leftIcon} />
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        style={[styles.input, { color: textColor }]}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value?.length ? (
        <IconButton
          icon="close"
            size={16}
            onPress={handleClear}
            iconColor={iconColor}
            style={styles.clearBtn}
            accessibilityLabel="Clear search"
            rippleColor={theme.colors?.backdrop}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  searchbar: {
    marginHorizontal: 0,
    marginBottom: CONTENTS_SEARCH_BAR_BOTTOM_MARGIN,
    borderRadius: 6,
    height: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 14,
    flex: 1,
    paddingVertical: 0,
    margin: 0,
    height: 36,
  },
  leftIcon: {
    marginRight: 6,
  },
  clearBtn: {
    marginLeft: 0,
    marginRight: -4,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchbarShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default React.memo(ContentsSearchBar);
