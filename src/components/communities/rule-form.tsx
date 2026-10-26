import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  communityErrorText,
  createCommunityRule,
  updateCommunityRule,
} from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityRule, RuleCategory } from '@/types/community';

const TITLE_MIN = 5;
const TITLE_MAX = 255;
const CONTENT_MAX = 2000;

const CATEGORIES: { value: RuleCategory; labelKey: string }[] = [
  { value: 'conduct', labelKey: 'communities.ruleConduct' },
  { value: 'prohibited', labelKey: 'communities.ruleProhibited' },
  { value: 'guidelines', labelKey: 'communities.ruleGuidelines' },
];

interface RuleFormProps {
  communityId: string;
  rule?: CommunityRule;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Port CommunityRuleForm — form inline thêm/sửa quy tắc (admin). */
export default function RuleForm({ communityId, rule, onSuccess, onCancel }: RuleFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isEdit = !!rule;

  const [category, setCategory] = useState<RuleCategory>(rule?.category ?? 'conduct');
  const [title, setTitle] = useState(rule?.title ?? '');
  const [content, setContent] = useState(rule?.content ?? '');
  const [loading, setLoading] = useState(false);

  const titleValid = title.trim().length >= TITLE_MIN;

  const handleSubmit = useCallback(async () => {
    if (!titleValid || loading) return;
    setLoading(true);
    try {
      const payload = {
        category,
        title: title.trim(),
        content: content.trim() || undefined,
      };
      if (isEdit && rule) {
        await updateCommunityRule(communityId, rule.id, payload);
      } else {
        await createCommunityRule(communityId, payload);
      }
      onSuccess();
    } catch (err) {
      // onSuccess đóng form — lỗi Alert để không mất thông báo.
      Alert.alert(t('common.error'), communityErrorText(err, t('communities.ruleError')));
    } finally {
      setLoading(false);
    }
  }, [category, communityId, content, isEdit, loading, onSuccess, rule, t, title, titleValid]);

  return (
    <View style={[styles.form, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Loại */}
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.ruleCategory')}
      </ThemedText>
      <View style={styles.chips}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.value;
          return (
            <Pressable
              key={cat.value}
              disabled={loading}
              onPress={() => setCategory(cat.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                  borderColor: active ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>
                {t(cat.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Tiêu đề */}
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.ruleTitle')}
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
        ]}
        value={title}
        onChangeText={setTitle}
        placeholder={t('communities.ruleTitlePlaceholder')}
        placeholderTextColor={theme.textSecondary}
        maxLength={TITLE_MAX}
        editable={!loading}
      />
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {title.length}/{TITLE_MAX}
      </ThemedText>

      {/* Nội dung */}
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('communities.ruleContent')}
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          styles.textarea,
          { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
        ]}
        value={content}
        onChangeText={setContent}
        placeholder={t('communities.ruleContentPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        maxLength={CONTENT_MAX}
        multiline
        editable={!loading}
      />
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {content.length}/{CONTENT_MAX}
      </ThemedText>

      {/* Hành động */}
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          disabled={loading}
          style={({ pressed }) => [
            styles.cancelBtn,
            { borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.cancelText}>{t('common.cancel')}</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={loading || !titleValid}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: theme.primary,
              opacity: loading || !titleValid ? 0.6 : 1,
            },
            pressed && styles.pressed,
          ]}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <ThemedText style={[styles.submitText, { color: theme.textOnPrimary }]}>
              {isEdit ? t('common.save') : t('communities.addRule')}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs + 2,
  },
  label: {
    ...Typography.caption,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.caption,
    fontSize: 11,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  cancelText: {
    ...Typography.body,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  submitText: {
    ...Typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
