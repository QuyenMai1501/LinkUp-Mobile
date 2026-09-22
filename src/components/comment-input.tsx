import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommentItem } from '../types/post';

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  replyingTo: CommentItem | null;
  onCancelReply: () => void;
  submitting: boolean;
}

export default function CommentInput({
  value,
  onChangeText,
  onSubmit,
  replyingTo,
  onCancelReply,
  submitting,
}: CommentInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      {replyingTo && (
        <View style={[styles.replyChip, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText style={[styles.replyText, { color: theme.primary }]}>
            {t('postDetail.replyingTo', { username: replyingTo.username })}
          </ThemedText>
          <Pressable onPress={onCancelReply} style={styles.cancelBtn}>
            <Icon name="close" size={14} color="#999" />
          </Pressable>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { borderColor: theme.border, backgroundColor: theme.bgSecondary, color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={t('postDetail.commentPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={onSubmit}
        />
        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: theme.primary },
            (!value.trim() || submitting) && { opacity: 0.5 },
          ]}
          onPress={onSubmit}
          disabled={!value.trim() || submitting}>
          <Icon name={submitting ? "hourglass" : "send"} size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  replyText: {
    fontSize: 12,
    flex: 1,
  },
  cancelBtn: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
