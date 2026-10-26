import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import {
  communityErrorText,
  createCommunity,
  type CreateCommunityAsset,
} from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityPrivacy } from '@/types/community';

export default function CreateCommunityScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('public');
  const [autoApprove, setAutoApprove] = useState(true);
  const [avatar, setAvatar] = useState<CreateCommunityAsset | null>(null);
  const [background, setBackground] = useState<CreateCommunityAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 100;

  const pickImage = useCallback(
    async (kind: 'avatar' | 'background') => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('story.permissionNeeded'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const a = result.assets[0];
      const asset: CreateCommunityAsset = {
        uri: a.uri,
        fileName: a.fileName || `${kind}-${Date.now()}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
      };
      if (kind === 'avatar') setAvatar(asset);
      else setBackground(asset);
    },
    [t],
  );

  const handleSubmit = useCallback(async () => {
    if (!nameValid || loading) return;
    setLoading(true);
    try {
      const res = await createCommunity({
        name: trimmedName,
        description: description.trim() || undefined,
        privacy,
        autoApprove,
        avatar,
        background,
      });
      Alert.alert(t('common.success'), t('communities.createSuccess'));
      (router as any).replace(`/(drawer)/communities/${res.community_id}`);
    } catch (err) {
      Alert.alert(t('common.error'), communityErrorText(err, t('communities.createError')));
    } finally {
      setLoading(false);
    }
  }, [avatar, background, description, loading, nameValid, privacy, autoApprove, router, t, trimmedName]);

  const privacyOptions: { value: CommunityPrivacy; icon: 'globe' | 'lock'; labelKey: string }[] = [
    { value: 'public', icon: 'globe', labelKey: 'communities.privacyPublic' },
    { value: 'invitation_only', icon: 'lock', labelKey: 'communities.privacyInvitation' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()} disabled={loading}>
            <Icon name="chevronLeft" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {t('communities.createTitle')}
          </ThemedText>
          <View style={styles.iconBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            {/* Hero: background + avatar */}
            <View>
              <Pressable
                onPress={() => void pickImage('background')}
                disabled={loading}
                style={({ pressed }) => [
                  styles.background,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                {background ? (
                  <Image
                    source={{ uri: background.uri }}
                    style={styles.backgroundImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.backgroundPlaceholder}>
                    <Icon name="images" size={26} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary" style={styles.backgroundHint}>
                      {t('communities.createBackgroundHint')}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
              {background && (
                <Pressable
                  onPress={() => setBackground(null)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.removeBg,
                    { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
                    pressed && styles.pressed,
                  ]}>
                  <Icon name="close" size={16} color={theme.textOnPrimary} />
                </Pressable>
              )}

              <Pressable
                onPress={() => void pickImage('avatar')}
                disabled={loading}
                style={({ pressed }) => [
                  styles.avatarBtn,
                  { borderColor: theme.card, backgroundColor: theme.bgSecondary },
                  pressed && styles.pressed,
                ]}>
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Icon name="camera" size={24} color={theme.textSecondary} />
                )}
              </Pressable>
            </View>

            {/* Name */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <ThemedText style={styles.label}>{t('communities.createName')}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.counter}>
                  {name.length}/100
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                ]}
                value={name}
                onChangeText={setName}
                placeholder={t('communities.createName')}
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
                editable={!loading}
                returnKeyType="next"
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <ThemedText style={styles.label}>{t('communities.createDesc')}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.counter}>
                  {description.length}/500
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('communities.createDesc')}
                placeholderTextColor={theme.textSecondary}
                maxLength={500}
                multiline
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Privacy */}
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('communities.privacy')}</ThemedText>
              <View style={styles.privacyRow}>
                {privacyOptions.map((opt) => {
                  const active = privacy === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPrivacy(opt.value)}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.privacyOption,
                        {
                          backgroundColor: active ? theme.primaryLight : theme.bgSecondary,
                          borderColor: active ? theme.primary : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <Icon
                        name={opt.icon}
                        size={18}
                        color={active ? theme.primary : theme.textSecondary}
                      />
                      <ThemedText
                        style={[
                          styles.privacyLabel,
                          { color: active ? theme.primary : theme.textSecondary },
                        ]}>
                        {t(opt.labelKey)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Auto-approve */}
            <View style={styles.field}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTexts}>
                  <ThemedText style={styles.label}>{t('communities.autoApprove')}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.toggleHint}>
                    {autoApprove ? t('communities.autoApproveOn') : t('communities.autoApproveOff')}
                  </ThemedText>
                </View>
                <Switch
                  value={autoApprove}
                  onValueChange={setAutoApprove}
                  disabled={loading}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={theme.textOnPrimary}
                />
              </View>
            </View>

            {/* Submit */}
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={!nameValid || loading}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: theme.primary,
                  opacity: !nameValid || loading ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}>
              {loading ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <ThemedText style={[styles.submitText, { color: theme.textOnPrimary }]}>{t('communities.createSubmit')}</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  background: {
    height: 130,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  backgroundImg: {
    width: '100%',
    height: '100%',
  },
  backgroundPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  backgroundHint: {
    ...Typography.caption,
  },
  removeBg: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    marginTop: -38,
    marginLeft: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  field: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  counter: {
    ...Typography.caption,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    paddingTop: Spacing.sm + 2,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
  },
  privacyLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  toggleTexts: {
    flex: 1,
    gap: 2,
  },
  toggleHint: {
    ...Typography.caption,
  },
  submitBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
