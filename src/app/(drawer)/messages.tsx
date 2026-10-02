import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConversationListItem } from '@/components/chat/conversation-list-item';
import { RecoveryGateModal } from '@/components/chat/recovery-gate-modal';
import { UserPickerModal } from '@/components/chat/user-picker-modal';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { useChatSocket } from '@/hooks/useChatSocket';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useE2ERecovery } from '@/hooks/useE2ERecovery';
import { listChats, createDirectChat } from '@/api/chat';
import { batchGetPresence } from '@/api/presence';
import { decryptChat, ensureChatKey, dbg } from '@/utils/e2ee';
import { onChatListDirty } from '@/utils/chat-list-dirty';
import { RECOVERY_RESOLVED_KEY } from '@/utils/e2e-flags';
import { Spacing, Typography } from '@/constants/theme';
import { Icon } from '@/components/ui/icon';
import type { ChatConversation } from '@/types/chat';

// Chạy fn trên từng item với tối đa `limit` song song, giữ nguyên thứ tự.
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export default function MessagesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { user } = useAuth();
  const socket = useChatSocket();
  const myUserId = user?.id ?? '';

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  // A3: chống double-load khi focus event + load effect cùng chạy.
  const lastRefreshAtRef = useRef(0);

  // Cổng khôi phục khóa E2E (thiết bị mới): chặn hydrate cho tới khi mở khóa
  // bằng PIN/recovery key hoặc bỏ qua. useE2ERecovery tự fetch meta khi mount.
  const e2eRecovery = useE2ERecovery();
  const [recoveryGate, setRecoveryGate] = useState<'checking' | 'unlocked' | 'skipped' | 'none'>('checking');
  const [recoverySecret, setRecoverySecret] = useState('');
  const [recoveryKind, setRecoveryKind] = useState<'pin' | 'recovery'>('pin');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Giải mã preview tin cuối của các hội thoại E2E. Nếu máy chưa có khóa
  // (chưa mở khóa chat nào) thì set-up khóa (lấy từ server / tạo mới) rồi giải
  // mã. Không set-up được (đối phương chưa đăng ký khóa) → để content rỗng để
  // UI hiện placeholder khóa.
  const hydrateConversations = useCallback(
    async (list: ChatConversation[]): Promise<ChatConversation[]> => {
      if (!myUserId) return list;

      const encryptedIndices: number[] = [];
      list.forEach((conv, i) => {
        if (
          conv.is_encrypted &&
          conv.last_message &&
          conv.last_message.content &&
          conv.last_message.e2e_version === 1
        ) {
          encryptedIndices.push(i);
        }
      });
      const encrypted = encryptedIndices.map((i) => list[i]);

      const hydrated = await mapLimited(encrypted, 4, async (conv) => {
        let key: string | null = null;
        try {
          key = await ensureChatKey({
            chatId: conv.chat_id,
            myUserId,
            partnerUserId: conv.partner.user_id,
          });
        } catch (err) {
          dbg(
            'hydrate', conv.chat_id, 'ensureChatKey THREW → placeholder:',
            err instanceof Error ? err.message : String(err),
          );
          key = null;
        }
        if (!key || !conv.last_message) {
          dbg('hydrate', conv.chat_id, 'no key → encryptedPreview placeholder');
          return { ...conv, last_message: { ...conv.last_message!, content: '' } };
        }
        try {
          const content = await decryptChat(conv.chat_id, conv.last_message.content);
          return { ...conv, last_message: { ...conv.last_message, content } };
        } catch (err) {
          dbg(
            'hydrate', conv.chat_id, 'decrypt FAILED → placeholder:',
            err instanceof Error ? err.message : String(err),
          );
          return { ...conv, last_message: { ...conv.last_message, content: '' } };
        }
      });

      const next = [...list];
      encryptedIndices.forEach((idx, j) => {
        next[idx] = hydrated[j];
      });
      return next;
    },
    [myUserId],
  );

  // Cổng khôi phục: nếu chưa từng "giải quyết" recovery trên máy này và server
  // có blob backup → chặn hydrate (khóa chưa có → preview cũng rỗng) cho tới khi
  // mở khóa hoặc bỏ qua. Đọc flag + setState nằm trong promise callback (async)
  // — tránh react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let seen = false;
      try {
        seen = (await AsyncStorage.getItem(RECOVERY_RESOLVED_KEY)) === '1';
      } catch {
        /* storage lỗi → coi như chưa thấy */
      }
      await Promise.resolve();
      if (cancelled) return;
      if (seen) {
        setRecoveryGate('none');
        return;
      }
      if (e2eRecovery.meta === null) return; // hook chưa fetch xong
      if (e2eRecovery.meta.has_blob && e2eRecovery.meta.salt) {
        setRecoveryGate('checking');
      } else {
        setRecoveryGate('none');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [e2eRecovery.meta]);

  // Load conversations — chỉ khi cổng khôi phục đã giải quyết (không còn 'checking').
  useEffect(() => {
    if (recoveryGate === 'checking') return;
    let cancelled = false;
    lastRefreshAtRef.current = Date.now();
    listChats()
      .then(async (res) => {
        const hydrated = await hydrateConversations(res.data);
        if (!cancelled) setConversations(hydrated);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hydrateConversations, recoveryGate]);

  // A4: batch presence khi danh sách hội thoại đổi (online của các partner).
  useEffect(() => {
    if (conversations.length === 0) return;
    const ids = [
      ...new Set(conversations.map((c) => c.partner.user_id).filter(Boolean)),
    ].slice(0, 100);
    if (ids.length === 0) return;
    let cancelled = false;
    batchGetPresence(ids)
      .then((res) => {
        if (cancelled) return;
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          for (const [uid, p] of Object.entries(res.data ?? {})) {
            if (p.status === 'online') next.add(uid);
            else next.delete(uid);
          }
          return next;
        });
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [conversations]);

  // Listen for presence updates via socket
  useEffect(() => {
    const unsub = socket.subscribe('presence:update', (payload: any) => {
      if (!payload.user_id || !payload.status) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (payload.status === 'online') next.add(payload.user_id);
        else next.delete(payload.user_id);
        return next;
      });
    });
    return unsub;
  }, [socket]);

  // Mở chat từ notification: notification type 'message' đi qua màn này với
  // param chat_id (xem utils/notification-navigate.ts). Chỉ mở khi id khớp 1
  // hội thoại thực tế; id không tồn tại / group chat → đứng yên ở danh sách.
  const { chat_id: notifyChatId } = useLocalSearchParams<{ chat_id?: string }>();
  const notifyChatOpenedRef = useRef(false);

  useEffect(() => {
    if (!notifyChatId || loading || notifyChatOpenedRef.current) return;
    const conv = conversations.find((c) => c.chat_id === notifyChatId);
    if (!conv) return;
    notifyChatOpenedRef.current = true;
    (router as any).push(`/(drawer)/chat/${conv.chat_id}`);
  }, [notifyChatId, loading, conversations, router]);

  const filtered = filter.trim()
    ? conversations.filter((c) =>
        c.partner.display_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : conversations;

  const refreshList = useCallback(async () => {
    try {
      const res = await listChats();
      const hydrated = await hydrateConversations(res.data);
      setConversations(hydrated);
    } catch {
      // silent
    }
  }, [hydrateConversations]);

  // A3: refresh "mềm" — chống spam khi focus + notification dirty cùng lúc.
  const softRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 1500) return;
    lastRefreshAtRef.current = now;
    void refreshList();
  }, [refreshList]);

  // A3: quay lại màn danh sách → refetch (tin mới trong lúc đang ở chat khác).
  useEffect(() => {
    const sub = navigation.addListener('focus', () => {
      if (recoveryGate === 'checking') return;
      softRefresh();
    });
    return sub;
  }, [navigation, softRefresh, recoveryGate]);

  // A3: có notification type='message' tới (notification WS) → debounce refresh.
  useEffect(() => {
    if (recoveryGate === 'checking') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onChatListDirty(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        softRefresh();
      }, 600);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [softRefresh, recoveryGate]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshList);

  const markRecoveryResolved = useCallback(() => {
    void AsyncStorage.setItem(RECOVERY_RESOLVED_KEY, '1').catch(() => {
      /* storage lỗi — lần sau sẽ hiện lại gate */
    });
  }, []);

  const handleRecoverySkip = useCallback(() => {
    markRecoveryResolved();
    setRecoveryGate('skipped');
  }, [markRecoveryResolved]);

  // Mở khóa: tryUnlock tự dẫn key + gửi hash check + import khóa vào AsyncStorage,
  // rồi hydrate lại danh sách hội thoại để preview giải mã được.
  const handleRecoveryUnlock = useCallback(async () => {
    if (!recoverySecret.trim() || e2eRecovery.busy) return;
    setRecoveryError(null);
    try {
      await e2eRecovery.tryUnlock(recoverySecret.trim(), recoveryKind);
      markRecoveryResolved();
      setRecoveryGate('unlocked');
      setRecoverySecret('');
      await refreshList();
    } catch (err) {
      setRecoveryError(err instanceof Error ? t(err.message) : t('common.error'));
    }
  }, [e2eRecovery, recoverySecret, recoveryKind, markRecoveryResolved, refreshList, t]);

  const handlePickUser = useCallback(
    async (user: { user_id: string }) => {
      setPickerOpen(false);
      try {
        const res = await createDirectChat(user.user_id);
        refreshList();
        (router as any).push(`/(drawer)/chat/${res.chat_id}`);
      } catch {
        // silent — chat may already exist
      }
    },
    [router, refreshList],
  );

  const handleSelect = useCallback(
    (conv: ChatConversation) => {
      (router as any).push(`/(drawer)/chat/${conv.chat_id}`);
    },
    [router],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={openDrawer} style={styles.actionBtn}>
            <Icon name="menu" size={20} color={colors.text} />
          </Pressable>
          <ThemedText style={[styles.title, { color: colors.text }]}>{t('chat.title')}</ThemedText>
          <Pressable onPress={() => setPickerOpen(true)} style={[styles.newChatBtn, { backgroundColor: colors.primary }]}>
            <Icon name="add" size={20} color="#FFF" />
          </Pressable>
        </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
        <Icon name="search" size={16} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={filter}
          onChangeText={setFilter}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
        />
        {filter.length > 0 && (
          <Pressable onPress={() => setFilter('')} hitSlop={8}>
            <Icon name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon name="chat" size={48} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary">
            {filter ? t('chat.noResults') : t('chat.noConversations')}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.chat_id}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              myUserId={myUserId}
              isOnline={onlineUsers.has(item.partner.user_id)}
              isActive={false}
              onPress={() => handleSelect(item)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      </SafeAreaView>

      <UserPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickUser}
      />

      {/* Cổng khôi phục E2E (thiết bị mới): mở khóa bằng PIN/recovery key */}
      <RecoveryGateModal
        visible={recoveryGate === 'checking'}
        busy={e2eRecovery.busy}
        secret={recoverySecret}
        kind={recoveryKind}
        error={recoveryError}
        onChangeSecret={setRecoverySecret}
        onChangeKind={(k) => {
          setRecoveryKind(k);
          setRecoveryError(null);
        }}
        onUnlock={() => void handleRecoveryUnlock()}
        onSkip={handleRecoverySkip}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    flex: 1,
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});
