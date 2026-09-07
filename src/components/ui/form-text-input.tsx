import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormTextInputProps = TextInputProps & {
  label: string;
  error?: string;
  secureTextEntry?: boolean;
};

export function FormTextInput({
  label,
  error,
  secureTextEntry = false,
  ...inputProps
}: FormTextInputProps) {
  const theme = useTheme();
  const [showValue, setShowValue] = useState(false);

  const isSecure = secureTextEntry && !showValue;

  return (
    <View style={styles.container}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>

      <View style={[styles.inputWrapper, { borderColor: error ? theme.danger : theme.border }]}>
        <TextInput
          {...inputProps}
          secureTextEntry={isSecure}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text },
            secureTextEntry && styles.inputWithToggle,
          ]}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setShowValue((prev) => !prev)}
            hitSlop={8}
            style={styles.toggle}
            aria-label={showValue ? 'Hide password' : 'Show password'}>
            <SymbolView
              tintColor={theme.textSecondary}
              name={{
                ios: showValue ? 'eye.slash.fill' : 'eye.fill',
                android: showValue ? 'visibility_off' : 'visibility',
                web: showValue ? 'visibility_off' : 'visibility',
              }}
              size={20}
            />
          </Pressable>
        )}
      </View>

      {!!error && (
        <ThemedText themeColor="danger" style={styles.error}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    width: '100%',
  },
  label: {
    ...Typography.caption,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  input: {
    ...Typography.body,
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'transparent',
  },
  inputWithToggle: {
    paddingRight: Spacing.xs,
  },
  toggle: {
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  error: {
    ...Typography.caption,
  },
});
