import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { updateProfile } from '@/api/profile';
import type { ViewProfileResponse, UpdateProfileInput } from '@/types/profile';

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

  const handleSave = async () => {
    const input: UpdateProfileInput = {};
    if (displayName !== profile.display_name) input.display_name = displayName;
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

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('profile.editProfile')}</ThemedText>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('profile.bio')}</ThemedText>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.label}>{t('profile.location')}</ThemedText>
              <TextInput
                value={location}
                onChangeText={setLocation}
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.label}>Work</ThemedText>
              <TextInput
                value={work}
                onChangeText={setWork}
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.label}>Education</ThemedText>
              <TextInput
                value={education}
                onChangeText={setEducation}
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.label}>Website</ThemedText>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </ScrollView>

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
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    width: '90%',
    maxHeight: '80%',
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
});
