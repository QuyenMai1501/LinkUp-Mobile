import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  communityErrorText,
  deleteCommunityRule,
  getCommunityRules,
} from '@/api/communities';
import RuleForm from '@/components/communities/rule-form';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityRule, RuleCategory } from '@/types/community';

const SKELETON_ROWS = 3;

const CATEGORY_LABELS: Record<RuleCategory | 'other', string> = {
  conduct: 'communities.ruleConduct',
  prohibited: 'communities.ruleProhibited',
  guidelines: 'communities.ruleGuidelines',
  other: 'communities.ruleCategory',
};

interface RuleListProps {
  communityId: string;
  isAdmin: boolean;
}

/** Port CommunityRules — nhóm quy tắc theo category, đánh số liên tục + CRUD (admin). */
export default function RuleList({ communityId, isAdmin }: RuleListProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [rules, setRules] = useState<CommunityRule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CommunityRule | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await getCommunityRules(communityId);
      setRules(res.rules);
      setLoadError(null);
    } catch (err) {
      setRules((prev) => prev ?? []);
      setLoadError(communityErrorText(err, t('communities.ruleError')));
    }
  }, [communityId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDelete = useCallback(
    (rule: CommunityRule) => {
      Alert.alert(t('communities.ruleDeleteTitle'), `${t('communities.ruleDeleteConfirm')} — “${rule.title}”`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCommunityRule(communityId, rule.id);
                await load();
              } catch (err) {
                Alert.alert(
                  t('common.error'),
                  communityErrorText(err, t('communities.ruleError')),
                );
              }
            })();
          },
        },
      ]);
    },
    [communityId, load, t],
  );

  const handleSuccess = useCallback(() => {
    setShowForm(false);
    setEditingRule(undefined);
    void load();
  }, [load]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingRule(undefined);
  }, []);

  const list = rules ?? [];

  // Nhóm theo category, sort nhóm theo position của rule đầu tiên.
  const grouped = list.reduce<Record<string, CommunityRule[]>>((acc, rule) => {
    const key = rule.category || 'other';
    (acc[key] ??= []).push(rule);
    return acc;
  }, {});
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (grouped[a][0]?.position ?? 0) - (grouped[b][0]?.position ?? 0),
  );

  // Số thứ tự liên tục theo đúng thứ tự hiển thị (Web dùng number++ trong loop).
  const orderedRules = sortedCategories.flatMap((category) =>
    [...grouped[category]].sort((a, b) => a.position - b.position),
  );
  const numberById = new Map(orderedRules.map((rule, i) => [rule.id, i + 1]));

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}>
      {isAdmin &&
        (showForm ? (
          <RuleForm
            communityId={communityId}
            rule={editingRule}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        ) : (
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.primaryLight },
              pressed && styles.pressed,
            ]}>
            <Icon name="add" size={16} color={theme.primary} />
            <ThemedText style={[styles.addText, { color: theme.primary }]}>
              {t('communities.addRule')}
            </ThemedText>
          </Pressable>
        ))}

      {rules === null && !loadError ? (
        Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <View
            key={i}
            style={[styles.ruleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.ruleNum, { backgroundColor: theme.bgSecondary }]} />
            <View style={[styles.skeletonLine, { backgroundColor: theme.bgSecondary }]} />
          </View>
        ))
      ) : loadError && list.length === 0 ? (
        <View style={styles.stateWrap}>
          <ThemedText themeColor="textSecondary" style={styles.stateText}>
            {loadError}
          </ThemedText>
          <Pressable
            onPress={() => {
              setRules(null);
              setLoadError(null);
              void load();
            }}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.retryText}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      ) : list.length === 0 && !showForm ? (
        <View style={styles.stateWrap}>
          <Icon name="shield" size={32} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.stateText}>
            {t('communities.noRules')}
          </ThemedText>
        </View>
      ) : (
        sortedCategories.map((category) => {
          const categoryRules = [...grouped[category]].sort((a, b) => a.position - b.position);
          return (
            <View key={category} style={styles.category}>
              <ThemedText themeColor="textSecondary" style={styles.categoryTitle}>
                {t(CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? 'communities.ruleCategory')}
              </ThemedText>
              {categoryRules.map((rule) => (
                <View
                  key={rule.id}
                  style={[styles.ruleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={[styles.ruleNum, { backgroundColor: theme.primaryLight }]}>
                    <ThemedText style={[styles.ruleNumText, { color: theme.primary }]}>
                      {numberById.get(rule.id)}
                    </ThemedText>
                  </View>
                  <View style={styles.ruleContent}>
                    <ThemedText style={styles.ruleTitle}>{rule.title}</ThemedText>
                    {rule.content ? (
                      <ThemedText themeColor="textSecondary" style={styles.ruleText}>
                        {rule.content}
                      </ThemedText>
                    ) : null}
                  </View>
                  {isAdmin && (
                    <View style={styles.ruleActions}>
                      <Pressable
                        hitSlop={6}
                        onPress={() => {
                          setEditingRule(rule);
                          setShowForm(true);
                        }}
                        style={({ pressed }) => [styles.ruleActionBtn, pressed && styles.pressed]}>
                        <Icon name="pencil" size={16} color={theme.textSecondary} />
                      </Pressable>
                      <Pressable
                        hitSlop={6}
                        onPress={() => handleDelete(rule)}
                        style={({ pressed }) => [styles.ruleActionBtn, pressed && styles.pressed]}>
                        <Icon name="trash" size={16} color={theme.danger} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  wrap: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
  },
  addText: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  category: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  categoryTitle: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
  },
  ruleNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleNumText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ruleContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ruleTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  ruleText: {
    ...Typography.caption,
    lineHeight: 18,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  ruleActionBtn: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  skeletonLine: {
    flex: 1,
    height: 16,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.lg,
  },
  stateText: {
    ...Typography.body,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
});
