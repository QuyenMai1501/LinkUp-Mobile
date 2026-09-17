import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { updateProfile } from '@/api/profile';
import type { ViewProfileResponse, UpdateProfileInput } from '@/types/profile';

const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '');
}

const DISPLAY_NAME_REGEX = /^[\p{L}\p{M}\d ]+$/u;
const MAX_DISPLAY_NAME = 55;
const MAX_BIO = 200;
const MAX_FIELD = 255;

interface ProfileEditModalProps {
  profile: ViewProfileResponse;
  onClose: () => void;
  onSaved: (updated: ViewProfileResponse) => void;
}

export function ProfileEditModal({ profile, onClose, onSaved }: ProfileEditModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [work, setWork] = useState(profile.work);
  const [education, setEducation] = useState(profile.education);
  const [website, setWebsite] = useState(profile.website);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    const trimmed = displayName.trim();
    const runeCount = Array.from(trimmed).length;

    if (!trimmed) {
      newErrors.display_name = t('profile.validation.displayNameRequired');
    } else if (runeCount < 3) {
      newErrors.display_name = t('profile.validation.displayNameMin');
    } else if (runeCount > MAX_DISPLAY_NAME) {
      newErrors.display_name = t('profile.validation.displayNameMax');
    } else if (!DISPLAY_NAME_REGEX.test(trimmed)) {
      newErrors.display_name = t('profile.validation.displayNameInvalid');
    }

    if (Array.from(bio).length > MAX_BIO) newErrors.bio = t('profile.validation.bioMax');
    if (Array.from(location).length > MAX_FIELD) newErrors.location = t('profile.validation.fieldMax');
    if (Array.from(work).length > MAX_FIELD) newErrors.work = t('profile.validation.fieldMax');
    if (Array.from(education).length > MAX_FIELD) newErrors.education = t('profile.validation.fieldMax');
    if (Array.from(website).length > MAX_FIELD) newErrors.website = t('profile.validation.fieldMax');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const input: UpdateProfileInput = {};
    if (trimmed !== profile.display_name) input.display_name = trimmed;
    if (bio !== profile.bio) input.bio = bio;
    if (location !== profile.location) input.location = location;
    if (work !== profile.work) input.work = work;
    if (education !== profile.education) input.education = education;
    if (website !== profile.website) input.website = website;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile(input);
      onSaved(res.data);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView style={[styles.modal, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={styles.closeIcon}>✕</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>{t('profile.editProfile')}</ThemedText>
            <View style={{ width: 32 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('profile.editProfile')}</ThemedText>
              <TextInput
                value={displayName}
                onChangeText={(v) => { setDisplayName(stripEmoji(v)); clearError('display_name'); }}
                maxLength={MAX_DISPLAY_NAME}
                style={[styles.input, { borderColor: errors.display_name ? theme.danger : theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
              {!!errors.display_name && <ThemedText themeColor="danger" style={styles.errorText}>{errors.display_name}</ThemedText>}
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('profile.bio')}</ThemedText>
              <TextInput
                value={bio}
                onChangeText={(v) => { setBio(stripEmoji(v)); clearError('bio'); }}
                maxLength={MAX_BIO}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { borderColor: errors.bio ? theme.danger : theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
              {!!errors.bio && <ThemedText themeColor="danger" style={styles.errorText}>{errors.bio}</ThemedText>}
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.label}>{t('profile.location')}</ThemedText>
                <TextInput
                  value={location}
                  onChangeText={(v) => { setLocation(stripEmoji(v)); clearError('location'); }}
                  maxLength={MAX_FIELD}
                  style={[styles.input, { borderColor: errors.location ? theme.danger : theme.border, color: theme.text }]}
                  placeholderTextColor={theme.textSecondary}
                />
                {!!errors.location && <ThemedText themeColor="danger" style={styles.errorText}>{errors.location}</ThemedText>}
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.label}>{t('profile.work')}</ThemedText>
                <TextInput
                  value={work}
                  onChangeText={(v) => { setWork(stripEmoji(v)); clearError('work'); }}
                  maxLength={MAX_FIELD}
                  style={[styles.input, { borderColor: errors.work ? theme.danger : theme.border, color: theme.text }]}
                  placeholderTextColor={theme.textSecondary}
                />
                {!!errors.work && <ThemedText themeColor="danger" style={styles.errorText}>{errors.work}</ThemedText>}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.label}>{t('profile.education')}</ThemedText>
                <TextInput
                  value={education}
                  onChangeText={(v) => { setEducation(stripEmoji(v)); clearError('education'); }}
                  maxLength={MAX_FIELD}
                  style={[styles.input, { borderColor: errors.education ? theme.danger : theme.border, color: theme.text }]}
                  placeholderTextColor={theme.textSecondary}
                />
                {!!errors.education && <ThemedText themeColor="danger" style={styles.errorText}>{errors.education}</ThemedText>}
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.label}>{t('profile.website')}</ThemedText>
                <TextInput
                  value={website}
                  onChangeText={(v) => { setWebsite(stripEmoji(v)); clearError('website'); }}
                  maxLength={MAX_FIELD}
                  style={[styles.input, { borderColor: errors.website ? theme.danger : theme.border, color: theme.text }]}
                  placeholderTextColor={theme.textSecondary}
                />
                {!!errors.website && <ThemedText themeColor="danger" style={styles.errorText}>{errors.website}</ThemedText>}
              </View>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>

          <View style={styles.footer}>
            <Button
              label={t('common.saveChanges')}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            />
          </View>
        </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: '5%',
    right: '5%',
    flexDirection: 'column',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 18, fontWeight: '700' },
  title: { ...Typography.h2, fontSize: 16 },
  keyboardView: { flex: 1 },
  scroll: { padding: Spacing.md },
  field: { marginBottom: Spacing.md },
  label: { ...Typography.caption, fontWeight: 600, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    ...Typography.body,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  footer: { padding: Spacing.md, borderTopWidth: 1 },
  errorText: { ...Typography.caption, marginTop: 2 },
});
