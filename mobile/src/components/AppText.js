import { Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Drop-in replacement for RN Text.
 * Automatically applies the user's chosen font size scale and font style.
 * All existing style props are preserved and merged on top.
 */
export default function AppText({ style, children, ...props }) {
  const { fontTypeObj, fs } = useTheme();

  // Extract fontSize from the incoming style(s) so we can scale it
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.map(s => s || {})) : (style || {});
  const baseFontSize = flatStyle.fontSize ?? 14;
  const scaledFontSize = fs(baseFontSize);

  return (
    <Text
      {...props}
      style={[
        fontTypeObj.style,       // font type (italic, bold, serif, etc.)
        style,                   // original styles (preserves color, margin, etc.)
        { fontSize: scaledFontSize }, // scaled font size always wins
      ]}
    >
      {children}
    </Text>
  );
}
