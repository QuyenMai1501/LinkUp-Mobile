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
- Screens: `app/(drawer)/index.tsx` (home — gồm segmented tabs **Khám phá / Đang theo dõi** ngay dưới tab `home|friends|notifications`, chỉ render khi đang ở tab home), `app/(drawer)/post/[postId].tsx`, `app/(drawer)/saved.tsx`
- Components: `components/feed.tsx` (props `filter?: string` — `'following'` = chỉ bài từ người theo dõi — + `onExplore`; remount qua key gồm feedKey + feedFilter để reset cursor/pagination khi đổi tab), `post-card.tsx` (menu ⋯ → report + follow badge/nút ở nameRow, ghim badge + privacy icon public/friend/private, +N overlay media, double-tap media để thích + tim burst, view count thay save khi own post, empty placeholder, hashtag → search), `post-composer.tsx` (toggle comments_enabled — mirror web commentsDisabled; hashtag autocomplete: gõ `#` → debounce 300ms `search(..., 'hashtags')` → tap chèn `#name `; draft AsyncStorage key `linkup.composer.draft` debounce 400ms — chip "Đã khôi phục bản nháp" + Xóa, xóa khi đăng thành công), `post-detail.tsx` (toggle follow ở authorRow + hashtag link; menu ⋯ hiện cho cả owner: copy link — hằng `postLink(id)` từ `constants/links.ts` → `https://linkup.io.vn/posts/{id}` — + owner toggle comments_enabled optimistic qua `setCommentsEnabled` + non-owner report; stats row like/share/view mirror web; ẩn comment input + hiện "Bài viết này đã tắt bình luận" khi `!comments_enabled`), `comment-sheet.tsx` (sort newest/oldest/relevant — reload trang 1), `comment-input.tsx`, `comment-item.tsx` (nút flag report), `share-options-sheet.tsx`, `media-viewer.tsx`, `rich-content.tsx` (prop `onHashtagPress`/`hashtagStyle` — không truyền thì hashtag là text thường)
- API: `api/posts.ts` (`getFeedPosts(cursor, pageSize, filter?)` — filter=following lấy từ server; dùng chung cho feed, saved, profile posts; `setCommentsEnabled(postId, enabled)` PATCH `/posts/:id/comments`), `api/reports.ts` (violation rules + tạo báo cáo), `api/follow.ts` (`followUser` toggle — optimistic ở feed/detail)
- Types: `types/post.ts`, `types/report.ts` (`ReportTargetType`, `ViolationRule`)

### Báo cáo / Vi phạm
- Components: `components/report-sheet.tsx` (sheet radio lý do + "Lý do khác" bắt buộc,severity pill, mount conditional — post-card/post-detail mount nội bộ, comment-sheet render **sibling** của Modal; **drag-to-dismiss gesture mirror comment-sheet** — pan + native scroll song song, backdrop fade/scale theo tiến độ vuốt, **chặn hoàn toàn pan khi `submitting`** qua shared value `blocked`), `components/menu-sheet.tsx` (menu ⋯ generic — copy link/report/toggle comments; **drag-to-dismiss gesture mirror comment-sheet** — luôn mount theo prop `visible`, slide-up khi mở/reset khi đóng, item press = animate close + `onPress` chạy ngay)
- API: `api/reports.ts` (`getViolationRules(targetType)`, `createReport`) · Types: `types/report.ts`
- Chú ý: ẩn report bài/bình luận của chính mình; lỗi hiển thị `ApiError.serverMessage`

### Stories (tin)
- Components: `components/story/` — `story-bar` (thanh story trên feed), `story-viewer` (xem full-screen: auto-advance 5s, react 6 emoji, share, reply→chat, xóa, phát video story từ Web, tin chữ), `story-composer` (tạo tin: nhiều ảnh + caption/tin chữ), `story-stats-modal` (thống kê chủ tin), `story-avatar-ring` (avatar bọc ring gradient — dùng chung bar + ProfileHeader)
- API: `api/story.ts` · Types: `types/story.ts` · Utils: `utils/story-reply-draft.ts` (draft trả lời → prefill composer chat, cùng pattern `forward-draft.ts`)
- Tích hợp: `components/feed.tsx` (mount bar + viewer + composer, reload sau tạo/xóa/ẩn), `components/profile/ProfileHeader.tsx` (ring + menu "Xem tin"), `app/(drawer)/chat/[chatId].tsx` (rút story-reply-draft), `components/chat/chat-composer.tsx` (prop `initialText`)
- Chú ý: server tự lọc muted/blocked ở feed; feed **bao gồm cả story của mình** (bar tự lọc group mình); tạo mới chỉ ảnh + tin chữ (không video, không canvas editor); video story tạo trên Web vẫn phát được bằng `expo-video`

### Tin nhắn 1-1 (chat)
- Screens: `app/(drawer)/chat/[chatId].tsx` (**file lớn nhất ~56KB**), `app/(drawer)/messages.tsx` (danh sách hội thoại)
- Components: `components/chat/` — `conversation-list-item`, `chat-bubble`, `chat-composer`, `message-actions`, `message-media`, `media-lightbox`, `media-cluster`, `typing-indicator`, `system-message`, `voice-player`, `emoji-image`, `forward-picker-modal`, `call-history-row`, `chat-background`, `chat-background-picker`, `shared-post-bubble`, `video-link-preview`, `share-to-chat-modal`, `user-picker-modal`, `recovery-gate-modal`; `components/menu-sheet.tsx`
- Hooks: `useChatRoom`, `useChatSocket`, `useChatE2E`, `useMessageMedia`, `useVoiceRecorder`
- API: `api/chat.ts` · Types: `types/chat.ts`
- Utils: `utils/chat.ts`, `chat-list-dirty.ts` (đánh dấu list cần refresh), `forward-draft.ts`, `videoLink.ts`, `media-cluster.ts` (gộp cụm ảnh), `id.ts` (`newId` client), `concurrency.ts` (`mapWithConcurrency` cap N, giữ thứ tự), `local-media.ts` (mediaId → file local URI)
- **Nhiều ảnh gửi cùng lúc (lưới thích ứng kiểu Messenger, 1-1 + group)**: mỗi file = 1 message riêng, caption/reply gắn ảnh đầu; batch >1 ảnh → client sinh 1 `media_group_id` (`utils/id.ts`) truyền qua `beginMediaUpload`/`completeMediaUpload` → server WS giữ + broadcast (DB `media_group_id`); timeline `clusterTimelineMedia` (`utils/media-cluster.ts`) gộp ảnh liên tiếp cùng sender + cùng group id → 1 bubble **`MediaCluster`** lưới thích ứng: **2–4 ảnh = 2 cột, 5+ = 3 cột**, ô vuông cover crop — **cạnh ô tính bằng px cố định từ `useWindowDimensions`** (KHÔNG dùng `% width` + aspectRatio trong flex-wrap parent auto — Yoga resolve % nhiều pass, grid height dao động làm time nhảy đỉnh/gap dư), chỉ ảnh vào lưới — video vẫn bubble riêng; giờ + ✓/✓✓/spinner của tin cuối = hàng dưới lưới hug mép phải dính đáy; tap ô → lightbox theo cụm; ảnh cũ `media_group_id: null` vẫn bubble to đơn lẻ. **Gửi 3 pha** (cả 2 màn `handleSend`): PHASE A `beginMediaUpload` sync toàn bộ batch → lưới hiện ngay đủ ô loading; PHASE B upload song song cap 3 (`mapWithConcurrency`, kết quả giữ thứ tự chọn); PHASE C wire WS tuần tự đúng thứ tự (FIFO echo khớp), lỗi → fail + 1 Alert tổng `chat.uploadFailedCount` (job giữ lại retry qua `handleRetry`); `completeMediaUpload` ghi `rememberLocalMediaUri(mediaId, localUri)` → `useMessageMedia` init src từ cache → remount echo không re-download, hết nháy. Đã xoá `media-stack.tsx` (chồng thẻ xoay/badge) + `chatMediaGroup.ts` (cửa sổ 3s)
- **Nền trò chuyện (1-1)**: render `components/chat/chat-background.tsx` (`ChatBackgroundLayer` — solid/gradient/preset/custom + scrim adaptive `utils/chat-readability.ts`) trong `messagesWrap`; mở picker (mode `direct`) từ Menu⋮ header (`menu-sheet.tsx`, icon `more` cạnh trash → item `chat.background` icon palette); preset ảnh local bundle `constants/chat-bg-presets.ts` + `assets/chat-bg/preset-01..12.jpg` (value = filename khớp Web — Web render `url(/presets/…)`); API `getChatBackground`/`updateChatBackground`/`deleteChatBackground` (`api/chat.ts`); parity Web — header nền riêng `ChatHeaderBackground` (solid/gradient nguyên bản, preset/custom + đen 0.55 cố định, không scrim adaptive) + chữ header buộc trắng khi có nền (`headerChrome`/`chromeIcon`/`chromeSub`), busyBg armor (bubble theirs viền+shadow, text-shadow tin mình `MessageText textShadow`, `newMessagesBar`) khi preset/custom, composer glass `BlurView` (`expo-blur`) khi `bgTransparent`

### Chat nhóm (group chat)
- Screens: `app/(drawer)/group-chat/[chatId].tsx`, `group-chat/settings.tsx`, `group-chat/shared-content.tsx`
- Components: `components/group-chat/` — `create-group-modal`, `group-invite-bubble`; `components/chat/add-group-member-modal.tsx`, `group-conversation-list-item.tsx`, `chat-background.tsx` (layer + `ChatHeaderBackground`), `chat-background-picker.tsx` (mode `group`)
- Hooks: `useGroupChatRoom`, `useGroupChatSocket`
- API: `api/group-chat.ts` · Types: `types/group-chat.ts`
- **Nền trò chuyện (group)**: cùng layer `chat-background.tsx` với 1-1 — state `chatBackground` trong `group-chat/[chatId].tsx`, picker + thumbnail preview 20px (dùng layer) trong `group-chat/settings.tsx`; API `get/update/deleteGroupChatBackground` (kèm `overlay_strength` 30–150) `api/group-chat.ts`; parity Web như 1-1 — `ChatHeaderBackground` + chữ header trắng + busyBg armor + composer glass

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
- Screen: `app/(drawer)/search.tsx` (hỗ trợ deep-link `?q=#tag` từ hashtag trong bài — prefill + tìm ngay khi mount) · API: `api/search.ts` · Types: `types/search.ts`

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

---

## Feed parity với Web (Phase 1→8)

Scope đã chốt: **không ads, không realtime, không story editor** — backend/web không sửa gì, chỉ port giao diện + hành vi sang mobile.

| Phase | Commit | Nội dung |
|---|---|---|
| 1 | `6183ae0` | `types/report.ts` + `api/reports.ts` — violation rules + tạo báo cáo |
| 2 | `2e7a8f8` | `menu-sheet` + `report-sheet` — báo cáo post/comment từ card/detail/comment-sheet (sibling của Modal), ẩn report của mình |
| 3 | `bef443a` | follow/unfollow từ feed + detail (optimistic, sync mọi post cùng `user_id`), badge "Đang theo dõi"/nút "Theo dõi" |
| 4 | `7c02f3a` | tab **Following** — segmented Khám phá/Đang theo dõi ở home, `filter=following`, empty state riêng |
| 5 | `a4e2f89` | card polish — ghim/privacy badge, +N media overlay, double-tap like + tim burst, view count own post, hashtag→search, sort bình luận (newest/oldest/relevant) |
| 6 | `6d0e63a` | composer — toggle `comments_enabled`, hashtag autocomplete (`#` → debounce 300ms), draft AsyncStorage (`linkup.composer.draft`) |
| 7 | `7814a06` | detail — menu ⋯ (copy link `https://linkup.io.vn/posts/{id}` qua `constants/links.ts`, toggle comments owner, report non-owner), stats row like/share/view, ẩn input khi `!comments_enabled` |
| 8 | — | locales dọn 10 keys thừa (ns `post`/`postDetail`/`composer`) — vi/en đồng bộ 0 lệch, 0 unused trong các ns đã sửa |

Verify mỗi phase: `npx tsc --noEmit` + `npm run lint` (baseline 28/15/13) + JSON parse 2 locales.
