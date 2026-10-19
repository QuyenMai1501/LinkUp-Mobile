# CODEMAP — Tra cứu code theo tính năng

Cấu trúc dự án là **type-based**: cùng một tính năng nằm rải several thư mục (`api/`, `hooks/`, `components/`, `types/`, `utils/`). Muốn sửa code của tính năng X, tra bảng dưới để mở đúng file — đừng chỉ search một thư mục.

## Cách tìm nhanh

| Cần gì | Làm gì |
|---|---|
| Theo tên file / symbol | VS Code `Ctrl+P` (hoặc `Ctrl+T`) |
| Theo từ khóa (tên file + nội dung) | `npm run find -- <từ khóa>` (git grep, chỉ file đã commit) |
| Theo bảng tính năng | Xem các mục bên dưới |
    
> Khi thêm tính năng mới hoặc file mới thuộc tính năng cũ → **cập nhật bảng này**.

## Quy ước cấu trúc

- **Screen luôn nằm ở `src/app/`** theo expo-router (route group `(drawer)` hoặc `(auth)`) — không đặt screen trong `components/`.
- **Variants `*.web.tsx`** chỉ chạy trên web, shadow file gốc (ví dụ `animated-icon.web.tsx`).
- **Naming trộn kiểu**: hooks có cả `useChatRoom` (camelCase) và `use-color-scheme` (kebab-case) — khi search thử cả hai dạng.
- Tokens & giao diện: xem `DESIGN.md`.

---

## Bảng tra cứu theo tính năng

### Auth (đăng nhập/đăng ký)
- Screens: `app/(auth)/` — `login.tsx`, `register.tsx`, `forgot-password.tsx`, `verify-email.tsx`, `_layout.tsx`
- Guard: `AuthRedirect` trong `app/_layout.tsx` (chưa đăng nhập → `/login`)
- API: `api/auth.ts`, `api/token-storage.ts`
- Context: `contexts/auth-context.tsx` (`useAuth`)
- Component: `components/google-auth-button.tsx`

### Feed / Posts / Bình luận
- Screens: `app/(drawer)/index.tsx` (home), `app/(drawer)/post/[postId].tsx`, `app/(drawer)/saved.tsx`
- Components: `components/feed.tsx`, `post-card.tsx`, `post-composer.tsx`, `post-detail.tsx`, `comment-sheet.tsx`, `comment-input.tsx`, `comment-item.tsx`, `share-options-sheet.tsx`, `media-viewer.tsx`
- API: `api/posts.ts` (dùng chung cho feed, saved, profile posts)
- Types: `types/post.ts`

### Stories (tin)
- Components: `components/story/` — `story-bar` (thanh story trên feed), `story-viewer` (xem full-screen: auto-advance 5s, react 6 emoji, share, reply→chat, xóa, phát video story từ Web, tin chữ), `story-composer` (tạo tin: nhiều ảnh + caption/tin chữ), `story-stats-modal` (thống kê chủ tin), `story-avatar-ring` (avatar bọc ring gradient — dùng chung bar + ProfileHeader)
- API: `api/story.ts` · Types: `types/story.ts` · Utils: `utils/story-reply-draft.ts` (draft trả lời → prefill composer chat, cùng pattern `forward-draft.ts`)
- Tích hợp: `components/feed.tsx` (mount bar + viewer + composer, reload sau tạo/xóa/ẩn), `components/profile/ProfileHeader.tsx` (ring + menu "Xem tin"), `app/(drawer)/chat/[chatId].tsx` (rút story-reply-draft), `components/chat/chat-composer.tsx` (prop `initialText`)
- Chú ý: server tự lọc muted/blocked ở feed; feed **bao gồm cả story của mình** (bar tự lọc group mình); tạo mới chỉ ảnh + tin chữ (không video, không canvas editor); video story tạo trên Web vẫn phát được bằng `expo-video`

### Tin nhắn 1-1 (chat)
- Screens: `app/(drawer)/chat/[chatId].tsx` (**file lớn nhất ~56KB**), `app/(drawer)/messages.tsx` (danh sách hội thoại)
- Components: `components/chat/` — `conversation-list-item`, `chat-bubble`, `chat-composer`, `message-actions`, `message-media`, `media-lightbox`, `media-stack`, `typing-indicator`, `system-message`, `voice-player`, `emoji-image`, `forward-picker-modal`, `call-history-row`, `chat-background-picker`, `shared-post-bubble`, `video-link-preview`, `share-to-chat-modal`, `user-picker-modal`, `recovery-gate-modal`
- Hooks: `useChatRoom`, `useChatSocket`, `useChatE2E`, `useMessageMedia`, `useVoiceRecorder`
- API: `api/chat.ts` · Types: `types/chat.ts`
- Utils: `utils/chat.ts`, `chatMediaGroup.ts`, `chat-list-dirty.ts` (đánh dấu list cần refresh), `forward-draft.ts`, `videoLink.ts`

### Chat nhóm (group chat)
- Screens: `app/(drawer)/group-chat/[chatId].tsx`, `group-chat/settings.tsx`, `group-chat/shared-content.tsx`
- Components: `components/group-chat/` — `create-group-modal`, `group-invite-bubble`; `components/chat/add-group-member-modal.tsx`, `group-conversation-list-item.tsx`
- Hooks: `useGroupChatRoom`, `useGroupChatSocket`
- API: `api/group-chat.ts` · Types: `types/group-chat.ts`

### Cuộc gọi (1-1 & nhóm)
- Contexts: `contexts/call-context.tsx`, `contexts/group-call-context.tsx` — overlay gắn ở root `app/_layout.tsx`
- Components: `components/calls/` — `call-overlay`, `group-call-overlay`, `group-call-incoming-modal`, `group-call-member-select-modal`, `group-call-participant-tile`, `group-call-history-bubble`
- Hooks: `useCallSocket`, `useGroupCallSocket`, `useChatCallHistory`
- API: `api/calls.ts` · Types: `types/call.ts`, `types/group-call.ts`
- Utils: `utils/ringtone.ts`

### E2EE (mã hóa đầu cuối)
- Core: `utils/e2ee.ts` (ECDH P-256 → HKDF-SHA256 → AES-256-GCM — **bắt buộc khớp byte với Web**, golden vector trong `../LinkUp_Web/__tests__/e2ee.golden.test.ts`)
- Selftest DEV: `utils/e2ee.selftest.ts` (chạy lúc app khởi động, log PASS/FAIL ở Metro)
- Storage/flags: `utils/e2e-storage.ts`, `utils/e2e-flags.ts`
- Polyfill: `src/polyfills.ts` — **phải là import đầu tiên** của `app/_layout.tsx`
- API: `api/e2e.ts` · Hooks: `useChatE2E`, `useE2ERecovery`
- Components: `components/chat/recovery-gate-modal.tsx`, `components/settings/e2e-recovery-form.tsx`

### Bạn bè / Follow / Block
- Screen: `app/(drawer)/friends.tsx`
- Components: `components/friend-card.tsx`, `friend-request-card.tsx`, `friends-list-panel.tsx`; `components/profile/FriendButton.tsx`, `MutualFriends.tsx`
- API: `api/friends.ts`, `api/follow.ts`, `api/block.ts` · Hooks: `useFollowStats` · Types: `types/friend.ts`

### Communities (cộng đồng)
- Screens: `app/(drawer)/communities/index.tsx` (list: tab discover/joined/created + search debounce + filter privacy), `communities/create.tsx` (tạo — **route riêng**, không RN Modal), `communities/[communityId].tsx` (detail: header + tab posts/members/rules/manage, remount theo `key={communityId}`) — **nhóm có `_layout.tsx` Stack con** (mirror `settings/`) để back = stack pop thay vì drawer history sập về feed
- Components: `components/communities/` — `community-card` (card list), `community-header` (cover + join/leave/pending/CTA code), `about-card` (giới thiệu + preview thành viên/quy tắc), `community-feed` (feed trong community, cursor derived `last.created_at,last.id` — server không trả next_cursor), `member-list` (admin: menu đổi vai trò + kick kèm lý do), `rule-list` + `rule-form` (CRUD quy tắc, group theo category, đánh số liên tục), `manage-tab` (4 section: settings / join-requests / invite-codes / transfer), `join-code-modal` (mã 6 ký tự `[A-Z0-9]`)
- API: `api/communities.ts` (22 hàm + `communityErrorText` — server community trả HTTP 400 cho gần như mọi lỗi, hiển thị `serverMessage`) · Types: `types/community.ts` (`isCommunityPrivileged`, `ManageableRole`)
- Tích hợp: `components/post-composer.tsx` (prop `communityId` → đăng bài trong community), `app/(drawer)/search.tsx` (kết quả tab communities → detail), `app/(drawer)/_layout.tsx` (screen drawer `communities` — create/detail là stack con, không đăng ký riêng), `constants/icon-map.ts` (`key`, `calendar`, `pencil`)
- Chú ý: **cố ý KHÔNG port bug Web** — feed cursor tự lấy từ bài cuối; join code tự uppercase; pending derive từ `request_id` thay vì hard-code; filter privacy chạy client-side trên response

### Thông báo & Push
- Context: `contexts/notification-context.tsx` (WS + unread badge, gắn ở root layout)
- API: `api/notifications.ts` · Types: `types/notification.ts`
- Utils: `utils/register-push.ts`, `notification-navigate.ts` (flush notification khi cold start), `group-notifications.ts`
- Component: `components/notification-item.tsx`

### Cài đặt (settings)
- Screens: `app/(drawer)/settings/` — `index`, `appearance`, `change-password`, `deactivate`, `notifications`, `privacy`, `security`, `sessions`, `storage`, `_layout`
- Components: `components/settings/` — `appearance-form`, `change-password-form`, `deactivate-account`, `e2e-recovery-form`, `notifications-form`, `privacy-form`, `sessions-manager`, `storage-info`
- API: `api/settings.ts` · Types: `types/settings.ts`

### Hồ sơ (profile)
- Screens: `app/(drawer)/profile.tsx` (của mình), `app/(drawer)/profile/[userId].tsx` (người khác)
- Components: `components/profile/` — `ProfileHeader`, `ProfileTabs`, `ProfileAboutTab`, `ProfileFriendsTab`, `ProfileMediaGrid`, `ProfileEditModal`, `ProfileMenu`, `ProfileSkeleton`, `FriendButton`, `MutualFriends`, `MediaLightbox`
- API: `api/profile.ts` · Hooks: `useProfilePosts` · Types: `types/profile.ts`
- Utils: `utils/profile-nav.ts` — `navigateToProfile(router, userId)` dùng chung khi bấm avatar/tên (feed, comment, chat, bạn bè…)

### Tìm kiếm
- Screen: `app/(drawer)/search.tsx` · API: `api/search.ts` · Types: `types/search.ts`

### Emoji / GIF (Giphy)
- Components: `components/emoji-picker.tsx`, `giphy-gif-picker.tsx`
- API: `api/giphy.ts`, `api/emojifyi.ts` (emoji từ server) · Hooks: `use-server-emojis` · Utils: `utils/emojis.ts`

### Theme / Giao diện / i18n
- Tokens: `constants/colors.ts`, `spacing.ts`, `typography.ts`, `icon-map.ts` — **`constants/theme.ts` là shim legacy, không thêm token mới**
- Contexts: `contexts/theme-context.tsx` (`ThemeModeProvider`/`useThemeMode`), `contexts/language-context.tsx` (`LanguageProvider`, mặc định `vi`)
- Hooks: `use-theme`, `useTranslation`, `use-color-scheme` (+ `.web.tsx`)
- Components gốc của template/themed: `themed-text`, `themed-view`, `ui/` (`button`, `collapsible`, `form-text-input`, `icon`), `animated-icon` (+ `.web`), `app-tabs` (+ `.web`), `drawer-content`, `external-link`, `web-badge`, `hint-row`
- Strings: `locales/vi.json`, `locales/en.json` (dot-path key, `{param}` interpolation) — chuỗi người dùng thấy **phải thêm đủ 2 file**

### Presence (đang hoạt động)
- API: `api/presence.ts` (`batchGetPresence`) — hiển thị online trong danh sách hội thoại (`messages.tsx`)

### Networking / API base
- `api/client.ts` — `request<T>()` với refresh-token mutex; `API_BASE` lấy từ `EXPO_PUBLIC_API_URL` (**phải gồm hậu tố `/api`**), fallback từ Metro hostUri
- WS đều derive từ `API_BASE` (`http→ws`) trong các hook socket + `notification-context`
