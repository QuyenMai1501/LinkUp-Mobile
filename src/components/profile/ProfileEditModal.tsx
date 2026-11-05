import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { showAlert } from '@/utils/alert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { updateProfile } from '@/api/profile';
import type { ViewProfileResponse, UpdateProfileInput } from '@/types/profile';

const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '');
}

// 'YYYY-MM-DD' (state) ↔ ISO string (API) — parity web ProfileEditModal.
function isoToDateOnly(iso?: string): string {
  return iso ? iso.split('T')[0] : '';
}

function dateOnlyToIso(dateOnly: string): string | null {
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function displayDate(dateOnly: string, language: string): string {
  if (!dateOnly) return '';
  const [y, m, d] = dateOnly.split('-');
  if (!y || !m || !d) return dateOnly;
  return language === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  isLast,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.toggleRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
      ]}>
      <View style={styles.toggleMeta}>
        <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.toggleHint}>
          {hint}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={theme.card}
      />
    </View>
  );
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
  const { t, language } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [work, setWork] = useState(profile.work);
  const [education, setEducation] = useState(profile.education);
  const [website, setWebsite] = useState(profile.website);
  const [dateOfBirth, setDateOfBirth] = useState(isoToDateOnly(profile.date_of_birth));
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [isPrivateProfile, setIsPrivateProfile] = useState(profile.is_private_profile);
  const [isPrivatePosts, setIsPrivatePosts] = useState(profile.is_private_posts);
  const [allowStrangerFriend, setAllowStrangerFriend] = useState(
    profile.allow_stranger_friend_request,
  );
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
    if (dateOfBirth !== isoToDateOnly(profile.date_of_birth)) {
      const iso = dateOnlyToIso(dateOfBirth);
      if (iso) input.date_of_birth = iso;
    }
    if (isPrivateProfile !== profile.is_private_profile) input.is_private_profile = isPrivateProfile;
    if (isPrivatePosts !== profile.is_private_posts) input.is_private_posts = isPrivatePosts;
    if (allowStrangerFriend !== profile.allow_stranger_friend_request) {
      input.allow_stranger_friend_request = allowStrangerFriend;
    }

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile(input);
      onSaved(res.data);
    } catch (err) {
      showAlert(
        t('common.error'),
        err instanceof Error && err.message ? err.message : t('profile.saveError'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDobChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android tự đóng picker sau khi chọn; iOS giữ inline spinner.
    if (Platform.OS !== 'ios') setShowDobPicker(false);
    if (event.type === 'dismissed' || !date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setDateOfBirth(`${y}-${m}-${d}`);
    clearError('date_of_birth');
  };

  const dobDate = (() => {
    const iso = dateOnlyToIso(dateOfBirth);
    return iso ? new Date(iso) : new Date();
  })();

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kbv}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={[styles.modal, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={18} />
            </Pressable>
            <ThemedText style={styles.title}>{t('profile.editProfile')}</ThemedText>
            <View style={{ width: 32 }} />
          </View>

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

            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('profile.dateOfBirth')}</ThemedText>
              <Pressable
                onPress={() => setShowDobPicker((v) => !v)}
                style={[styles.input, styles.dobTrigger, { borderColor: theme.border }]}>
                <ThemedText style={{ color: dateOfBirth ? theme.text : theme.textSecondary }}>
                  {displayDate(dateOfBirth, language) || t('profile.birthday')}
                </ThemedText>
                <Icon name="calendar" size={16} color={theme.textSecondary} />
              </Pressable>
              {showDobPicker && (
                <DateTimePicker
                  value={dobDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={handleDobChange}
                />
              )}
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('profile.privacySection')}</ThemedText>
              <View style={[styles.toggleCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <ToggleRow
                  label={t('profile.privateProfileLabel')}
                  hint={t('profile.privateProfileHint')}
                  value={isPrivateProfile}
                  onValueChange={setIsPrivateProfile}
                />
                <ToggleRow
                  label={t('profile.privatePosts')}
                  hint={t('profile.privatePostsHint')}
                  value={isPrivatePosts}
                  onValueChange={setIsPrivatePosts}
                />
                <ToggleRow
                  label={t('profile.allowStrangerFriend')}
                  hint={t('profile.allowStrangerFriendHint')}
                  value={allowStrangerFriend}
                  onValueChange={setAllowStrangerFriend}
                  isLast
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kbv: {
    flex: 1,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    marginHorizontal: Spacing.lg,
    flexDirection: 'column',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
  dobTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  toggleMeta: { flex: 1 },
  toggleLabel: { ...Typography.body, fontWeight: '600' },
  toggleHint: { ...Typography.caption, marginTop: 2 },
  footer: { padding: Spacing.md, borderTopWidth: 1 },
  errorText: { ...Typography.caption, marginTop: 2 },
});
