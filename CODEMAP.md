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
- Components: `components/google-auth-button.tsx` (icon Google 4 màu `assets/images/google-g.png`; lỗi → `apiErrorMessage`), `components/auth/auth-quick-toggles.tsx` (2 nút góc trên phải màn chưa đăng nhập: dark/light + ngôn ngữ — mount absolute trong `app/(auth)/_layout.tsx`, chỉ toggle local không gọi API)

### Feed / Posts / Bình luận
- Screens: `app/(drawer)/index.tsx` (home — gồm segmented tabs **Khám phá / Đang theo dõi / Thịnh hành** ngay dưới tab `home|friends|notifications`, chỉ render khi đang ở tab home; tab Thịnh hành render `trending-hashtags.tsx` thay cho `Feed`), `app/(drawer)/post/[postId].tsx`, `app/(drawer)/saved.tsx`
- Components: `components/feed.tsx` (props `filter?: string` — `'following'` = chỉ bài từ người theo dõi — + `onExplore`; remount qua key gồm feedKey + feedFilter để reset cursor/pagination khi đổi tab), `post-card.tsx` (menu ⋯ → report + follow badge/nút ở nameRow, ghim badge + privacy icon public/friend/private, +N overlay media, double-tap media để thích + tim burst, view count thay save khi own post, empty placeholder, hashtag → screen hashtag), `post-composer.tsx` (toggle comments_enabled — mirror web commentsDisabled; hashtag autocomplete: gõ `#` → debounce 300ms `search(..., 'hashtags')` → tap chèn `#name `; draft AsyncStorage key `linkup.composer.draft` debounce 400ms — chip "Đã khôi phục bản nháp" + Xóa, xóa khi đăng thành công), `post-detail.tsx` (toggle follow ở authorRow + hashtag link → screen hashtag; menu ⋯ hiện cho cả owner: copy link — hằng `postLink(id)` từ `constants/links.ts` → `https://linkup.io.vn/posts/{id}` — + owner toggle comments_enabled optimistic qua `setCommentsEnabled` + non-owner report; stats row like/share/view mirror web; ẩn comment input + hiện "Bài viết này đã tắt bình luận" khi `!comments_enabled`), `comment-sheet.tsx` (sort newest/oldest/relevant — reload trang 1), `comment-input.tsx`, `comment-item.tsx` (nút flag report), `share-options-sheet.tsx`, `media-viewer.tsx`, `rich-content.tsx` (prop `onHashtagPress`/`hashtagStyle` — không truyền thì hashtag là text thường)
- API: `api/posts.ts` (`getFeedPosts(cursor, pageSize, filter?)` — filter=following lấy từ server; dùng chung cho feed, saved, profile posts; `getPostsByHashtag(name, page, pageSize)` — **page-based** `GET /posts/hashtag/:name`, khác cursor của feed; `setCommentsEnabled(postId, enabled)` PATCH `/posts/:id/comments`), `api/reports.ts` (violation rules + tạo báo cáo), `api/follow.ts` (`followUser` toggle — optimistic ở feed/detail)
- Types: `types/post.ts`, `types/report.ts` (`ReportTargetType`, `ViolationRule`)

### Báo cáo / Vi phạm
- Components: `components/report-sheet.tsx` (sheet radio lý do + "Lý do khác" bắt buộc,severity pill, mount conditional — post-card/post-detail mount nội bộ, comment-sheet render **sibling** của Modal; **drag-to-dismiss gesture mirror comment-sheet** — pan + native scroll song song, backdrop fade/scale theo tiến độ vuốt, **chặn hoàn toàn pan khi `submitting`** qua shared value `blocked`), `components/menu-sheet.tsx` (menu ⋯ generic — copy link/report/toggle comments; **drag-to-dismiss gesture mirror comment-sheet** — luôn mount theo prop `visible`, slide-up khi mở/reset khi đóng, item press = animate close + `onPress` chạy ngay)
- API: `api/reports.ts` (`getViolationRules(targetType)`, `createReport`) · Types: `types/report.ts`
- Chú ý: ẩn report bài/bình luận của chính mình; lỗi hiển thị `ApiError.serverMessage`

### Stories (tin)
- Components: `components/story/` — `story-bar` (thanh story trên feed), `story-viewer` (xem full-screen: auto-advance 5s, react 6 emoji, share, reply→chat, xóa, phát video story từ Web, tin chữ), `story-composer` (tạo tin — **flow 3 bước pick → edit → post** như Web: đa ảnh cap 10, caption từng ảnh ở bước post, tin chữ gradient; step edit mount `story-editor` theo `key={index:uri}`, flush snapshot trước khi đổi ảnh/Tiếp tục, upload `finalUris[i] ?? uri`, doc init qua `emptyDoc()`), `story-editor` (bước edit — **Skia canvas 1080×1920** nội suy/export: bg blur-fill + contain, pan/pinch ảnh hoặc layer đang chọn (target = hit-test box selected, seed SV trước setState, commit debounce 80ms), tap chọn layer / gõ để sửa chữ, undo/redo checkpoint cap 20 (bao gồm cả strokes + filter), **vẽ tay**: tool `draw` → gesture Pan `minDistance(0)` chỉ ghi SharedValue (livePtsSV/livePathSV/gradSV, không setState giữa gesture) → `endStroke` runOnJS đẩy pre-state vào past; **tẩy** = Tap-to-remove từng nét (hitStroke tolerance 12px, top-most, parity web discrete remove); **filter** = ColorMatrix 4×5 (matrix build từ cssFilter formulas của web: bw/warm/cool/vintage/dramatic + intensity 0–1) áp cho bg chính, blur backdrop KHÔNG lọc (parity web), render order bg → layers → strokes → live path; toolbar 7 nút icon-only full-width (thêm chữ/sticker/vẽ/lọc + undo/redo/xóa, `tool: 'stickers'|'draw'|'filter'|null`), panel chữ `story-editor-text-panel` (preset/màu/gradient/viền/nền/align, 3 font hệ thống), panel vẽ `story-editor-brush-panel` (cỡ bút ScrubSlider 2–24 web px → canvas ×C, 10 màu `COLOR_PRESETS`, gradient from/to, chip tẩy, Xóa nét vẽ), panel filter `story-editor-filter-panel` (6 tile thumbnail Skia mini 56×64 `Image cover` + ColorMatrix, intensity slider %), lưới 18 sticker `story-editor-sticker-panel` PNG raster từ Noto (`assets/images/stickers/`); controls dùng chung `story-editor-controls` (ScrubSlider/SwatchRow/ToggleChip — extract từ text-panel), `flush()` snapshot → normalize `MakeOffscreen` nếu lệch → JPEG base64 qua `expo-file-system` File/Paths; panel render absolute trên toolbar), `story-stats-modal` (thống kê chủ tin), `story-avatar-ring` (avatar bọc ring gradient — dùng chung bar + ProfileHeader)
- API: `api/story.ts` · Types: `types/story.ts` · Utils: `utils/story-reply-draft.ts` (draft trả lời → prefill composer chat, cùng pattern `forward-draft.ts`)
- Tích hợp: `components/feed.tsx` (mount bar + viewer + composer, reload sau tạo/xóa/ẩn), `components/profile/ProfileHeader.tsx` (ring + menu "Xem tin"), `app/(drawer)/chat/[chatId].tsx` (rút story-reply-draft), `components/chat/chat-composer.tsx` (prop `initialText`)
- Chú ý: server tự lọc muted/blocked ở feed; feed **bao gồm cả story của mình** (bar tự lọc group mình); video story tạo trên Web vẫn phát được bằng `expo-video`
- **Editor đang port từ Web theo phase**: P1 = flow 3 bước + pan/zoom 9:16 (xong) · P2 = text/sticker/undo/redo/export JPEG 1080×1920 qua Skia (xong — cài `@shopify/react-native-skia@2.14.0` tường minh, KHÔNG dùng `expo install` vì pin 2.6.2 của SDK 57 dính bug với RN 0.86, expo#50733; cần rebuild dev-client; **gap**: font chỉ 3 family hệ thống — Web dùng Google Fonts, bỏ xoay layer vì Web không có gesture xoay) · P3 = vẽ tay + filter (xong — **gap**: strokes luôn render trên layers dù chèn trước/sau text (Web theo thứ tự chèn), filter chỉ port cssFilter formula của web — bỏ tint/fabric extras, intensity step 0.05 của web → slider liên tục; eraser discrete tap từng nét như web; toolbar đổi icon-only 7 nút full-width) · P4 = video upload (tiếp theo) · P5 = nhạc (native module AVFoundation + Media3)

### Tin nhắn 1-1 (chat)
- Screens: `app/(drawer)/chat/[chatId].tsx` (**file lớn nhất ~56KB**), `app/(drawer)/messages.tsx` (danh sách hội thoại)
- Components: `components/chat/` — `conversation-list-item`, `chat-bubble` (`MessageText` truyền `onHashtagPress` → screen hashtag — mirror EmojiImage của web), `chat-composer`, `message-actions`, `message-media`, `media-lightbox`, `media-cluster`, `typing-indicator`, `system-message`, `voice-player`, `emoji-image`, `forward-picker-modal`, `call-history-row`, `chat-background`, `chat-background-picker`, `shared-post-bubble`, `video-link-preview`, `share-to-chat-modal`, `user-picker-modal`, `recovery-gate-modal`; `components/menu-sheet.tsx`
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
- Screens: `app/(drawer)/communities/index.tsx` (list: tab discover/joined/created + search debounce + filter privacy), `communities/create.tsx` (tạo — **route riêng**, không RN Modal), `communities/[communityId].tsx` (detail mirror Web: header page-level trên mọi tab + pill tabs `posts/challenges/leaderboard/members/rules/manage`, locked panel có CTA Join/Enter code, remount theo `key={communityId}`) — **nhóm có `_layout.tsx` Stack con** (mirror `settings/`) để back = stack pop thay vì drawer history sập về feed
- Components: `components/communities/` — `community-card` (card list, badge từ `membership_status` + `onJoinedCommunity` callback), `community-header` (cover gradient/scrim + badge privacy top-left + join/leave/pending/Invite-only pill + report button), `about-card` (giới thiệu + preview thành viên/quy tắc = rail phải Web), `community-feed` (feed trong community, cursor derived `last.created_at,last.id` — server không trả next_cursor), `challenges-tab` (filter pills + card + join + form tạo/sửa datetime text `YYYY-MM-DDTHH:mm` + participants modal), `leaderboard-tab` (podium top-3 + list + card "Thành tích của bạn"), `member-list` (admin: menu đổi vai trò + kick kèm lý do, nhận prop `header`), `rule-list` + `rule-form` (CRUD quy tắc, group theo category, đánh số liên tục, prop `header`), `manage-tab` (5 section: settings / **policy** / join-requests / invite-codes / transfer), `join-code-modal` (mã 6 ký tự `[A-Z0-9]`)
- API: `api/communities.ts` (22 hàm + `communityErrorText` — server community trả HTTP 400 cho gần như mọi lỗi, hiển thị `serverMessage`), `api/contribution.ts` (10 hàm: challenges, leaderboard, my-contribution, policy — port từ Web) · Types: `types/community.ts` (`isCommunityPrivileged`, `ManageableRole`), `types/contribution.ts`, `types/report.ts` (`ReportTargetType` += `community`)
- Tích hợp: `components/post-composer.tsx` (prop `communityId` → đăng bài trong community), `app/(drawer)/search.tsx` (kết quả tab communities → detail), `app/(drawer)/_layout.tsx` (screen drawer `communities` — create/detail là stack con, không đăng ký riêng), `constants/icon-map.ts` (`key`, `calendar`, `pencil`, `trophy`, `medal`), `components/report-sheet.tsx` (target `community`)
- Chú ý: **cố ý KHÔNG port bug Web** — feed cursor tự lấy từ bài cuối; join code tự uppercase; pending derive từ `request_id` thay vì hard-code; filter privacy chạy client-side trên response; datetime challenge nhập text (không thêm dep picker)

### Thông báo & Push
- Context: `contexts/notification-context.tsx` (WS + unread badge, gắn ở root layout)
- API: `api/notifications.ts` · Types: `types/notification.ts`
- Utils: `utils/register-push.ts`, `notification-navigate.ts` (flush notification khi cold start), `group-notifications.ts`
- Component: `components/notification-item.tsx`

### Cài đặt (settings)
- Screens: `app/(drawer)/settings/` — `index` (3 nhóm Tài khoản/Ứng dụng/Khác, icon tile + chevron), `appearance`, `change-password`, `deactivate`, `notifications`, `privacy`, `security`, `sessions`, `storage` (wrap qua `settings-screen`), `_layout` (header ẩn, header tự dựng)
- Components: `components/settings/` — `settings-row` (hàng dùng chung: icon tile tone + label/hint + chevron hoặc control), `settings-screen` (header back + ScrollView wrapper), `appearance-form`, `change-password-form`, `deactivate-account`, `e2e-recovery-form`, `notifications-form`, `privacy-form`, `sessions-manager`, `storage-info`
- API: `api/settings.ts` · Types: `types/settings.ts`

### Hồ sơ (profile)
- Screens: `app/(drawer)/profile.tsx` (của mình), `app/(drawer)/profile/[userId].tsx` (người khác)
- Components: `components/profile/` — `ProfileHeader`, `ProfileTabs`, `ProfileAboutTab`, `ProfileFriendsTab`, `ProfileMediaGrid`, `ProfileEditModal`, `ProfileMenu`, `ProfileSkeleton`, `FriendButton`, `MutualFriends`, `MediaLightbox`
- API: `api/profile.ts` · Hooks: `useProfilePosts` · Types: `types/profile.ts`
- Utils: `utils/profile-nav.ts` — `navigateToProfile(router, userId)` dùng chung khi bấm avatar/tên (feed, comment, chat, bạn bè…)

### Tìm kiếm
- Screen: `app/(drawer)/search.tsx` (hỗ trợ deep-link `?q=#tag` từ hashtag trong bài — prefill + tìm ngay khi mount; tap hashtag trong kết quả → push screen hashtag) · API: `api/search.ts` (`search(keyword, type)` + `getTrendingHashtags()` → `GET /trending` → `{data: HashtagSearchResult[]}`) · Types: `types/search.ts`

### Hashtag
- Screen: `app/(drawer)/hashtag/[name].tsx` — feed bài theo tag, mirror web `app/(user)/hashtag/[name]/page.tsx`: header cố định back + `#name` + số bài (`formatCount`), skeleton shimmer, error + retry, empty, FlatList `PostCard` phân trang **page-based** (`page+1` khi `data.length >= 10`, dedupe id, `feedPostCache`), actions optimistic like/save/follow/share (copy `community-feed.tsx`), CommentSheet + MediaViewer + ShareOptionsSheet + ShareToChatModal; đăng ký `(drawer)/_layout.tsx` `hashtag/[name]` (swipeEnabled:false)
- Components: `components/trending-hashtags.tsx` — panel hashtag thịnh hành (tab "Thịnh hành" trên feed, mobile-only — web dùng RightSidebar), row copy hashtag row của search (iconBox `#`, `post_count` + `formatCount`), tap → screen hashtag; loading/error+retry/empty + pull-to-refresh
- Tích hợp: `post-card.tsx`/`post-detail.tsx`/`chat/chat-bubble.tsx` `openHashtag` → push `/(drawer)/hashtag/{tag}` (chỉ khi truyền `onHashtagPress` cho `rich-content.tsx`); comment + story **không** linkify (web cũng plain text)
- i18n (vi+en): `hashtag.posts|empty|error`, `feed.tabTrending|trendingEmpty|trendingError`

### Emoji / GIF (Giphy)
- Components: `components/emoji-picker.tsx` (grid 8 cột render `character` native + search debounce 400ms + 9 tab category hardcode khớp seed server, infinite scroll `onEndReached` 60/trang, cache per-tab `useRef<Map>`), `giphy-gif-picker.tsx`
- Emoji data: **DB server** — `GET /emojis` qua `getEmojis({q,category,limit,offset,scope})` trong `api/posts.ts` (`EmojisResponse {data,total,has_more}`); không còn gọi API ngoài (emojifyi chỉ giữ nhận diện URL legacy trong `api/emojifyi.ts`)
- Render: chip/sticker/quick-react/story reaction đều vẽ `<Text>{character}</Text>` (server `image_uri` rỗng — seed ưu tiên `character`); `:code:` fallback qua `utils/emojis.ts` (EMOTION_EMOJIS unicode) trong `rich-content.tsx`/`emoji-image.tsx`
- Hooks: `use-server-emojis` (cache module `byId`/`byCode` + `quickReactEmojis`) · Types: `EmojiItem` đầy đủ trong `types/post.ts` · Utils: `utils/emojis.ts`

### Partner Hub (quảng cáo / ads management)
- Screens: `app/(drawer)/partner/` — `_layout.tsx` (Stack con, `headerShown:false, swipeEnabled:false`), `packages.tsx` (danh sách gói + chọn radio + thanh toán VNPay "Coming Soon"/gói free active, subscribe → `signIn({user, tokens})` lưu JWT role PARTNER mới → `replace('/partner/dashboard')`, `useFocusEffect` refetch, guard thiếu token → `sessionError`), `dashboard.tsx` (hero Remaining + progress bar spent/total, grid 6 stat card, card subscription, pull-to-refresh + CTA), `ads.tsx` (FlatList phân trang 20/trang + `onEndReached`, search debounce 400ms, filter chips, pull-to-refresh, focus refetch, card thumb 56 + badge + stats + actions pause/play/edit/analytics/trash với Alert confirm), `ad-form.tsx` (mode theo `?id=`; edit prefill `getMyAds().find()` + banner status/rejection_reason; create: media picker images+videos, format chips gate theo capabilities gói, gender/age/locations, dates → RFC3339, validation inline red khi `tried`, footer save), `ad-analytics.tsx` (header card + budget hero (remaining/total/daily + progress) + grid 2×2 metrics + rates CTR/CPC/CPM + video card)
- Components: `components/sponsored-ad-card.tsx` — card "Tài trợ" (badge, expo-image, CTA → `trackAdAction(id,'click')` fire-and-forget + `Linking.openURL(target_url)`); tích hợp `components/feed.tsx`: `getFeedAds()` 1 lần khi mount (async `.then(setState)` — pass lint react-hooks/set-state-in-effect), `rows` memo union `FeedRow` chèn ad **trước** post khi `idx>0 && (idx+1)%6===0` xoay vòng `feedAds[adSlot % len]`, `keyExtractor` ad → `ad-${slot}`, impression dedupe 1 lần/session qua `trackedAdsRef` trong `onViewableItemsChanged` (cùng viewability threshold 50%/2s với post)
- API: `api/partner.ts` (`getOverview/getAdAnalytics/getMyAds` unwrap `{data}`; `createAd/updateAd` → **multipart flat fields** `buildAdFormData` (không nhận JSON `data`); `getFeedAds` → `GET /api/customer/feed`; `trackAdAction(adId, 'impression'|'click')`), `api/package.ts` (`getPackages/getMySubscription/subscribe`, 404 `package.NOT_SUBSCRIBED`)
- Types: `types/partner.ts` (AdPerformance keys khớp DTO: `click_through_rate/cost_per_click/cost_per_thousand_impressions`) · Constants: `constants/ad-status.ts` (`AD_STATUS_BADGES` hex y hệt web `Ads.module.css`) · Utils: `utils/format.ts` (formatVnd/formatCount/formatPercent/formatDate, `language`-aware), `apiErrorMessage` trong `api/client.ts`
- Entry: `settings/index.tsx` role-gated qua `decodeToken(accessToken)?.role` (USER → `/partner/packages`, PARTNER+ → `/partner/dashboard`, đặt trước deactivate); screen đăng ký `(drawer)/_layout.tsx` (drawer menu custom `NAV_ITEMS` **không hiện** Partner); **exit toàn cục**: `partner/_layout.tsx` `headerRight` icon `close` → `canGoBack() ? back() : replace('/')` (mọi màn partner, không đụng `headerLeft` back); **upgrade**: `dashboard.tsx` card subscription → nút push `/partner/packages`, `packages.tsx` so `package_name` (server không trả `package_id`) → gói active viền primary + nút disabled "Đã đăng ký", chọn gói khác → Alert xác nhận (hủy gói cũ, slots/hạn reset) — server `SubscribeWithTransaction` hủy gói cũ + reissue token
- i18n (vi+en): `partner.*`, `packages.*`, `payment.*`, `settings.items.partnerBecome|partnerHub`, `feed.sponsored`/`feed.sponsoredCta`
- Chú ý: ad endpoints trả wrapper `{data}` (list nhánh ADMIN không có total); server `RequireRoles(SUPER_ADMIN, ADMIN, PARTNER)`; không `GET /ads-management/:id` (edit prefill qua list); CTR = clicks/impressions×100; web gửi `datetime-local` bị server ignore → mobile dùng `toISOString()`; **không thêm dependency mới**

### Theme / Giao diện / i18n
- Tokens: `constants/colors.ts`, `spacing.ts`, `typography.ts`, `icon-map.ts` — **`constants/theme.ts` là shim legacy, không thêm token mới**
- Contexts: `contexts/theme-context.tsx` (`ThemeModeProvider`/`useThemeMode`), `contexts/language-context.tsx` (`LanguageProvider`, mặc định `vi`)
- Hooks: `use-theme`, `useTranslation`, `use-color-scheme` (+ `.web.tsx`)
- Components gốc của template/themed: `themed-text`, `themed-view`, `ui/` (`button`, `collapsible`, `form-text-input`, `icon`), `animated-icon` (+ `.web`), `app-tabs` (+ `.web`), `drawer-content`, `external-link`, `web-badge`, `hint-row`
- Strings: `locales/vi.json`, `locales/en.json` (dot-path key, `{param}` interpolation) — chuỗi người dùng thấy **phải thêm đủ 2 file**
- Lỗi backend: mục `errors` trong 2 file locales (mã `auth.XXX` → thông báo vi/en, `{{param}}` interpolation) + `utils/resolve-error.ts` (`resolveErrorCode(code, params)` — `setErrorLanguage` do `language-context` gọi lúc load/đổi ngôn ngữ)

### Presence (đang hoạt động)
- API: `api/presence.ts` (`batchGetPresence`) — hiển thị online trong danh sách hội thoại (`messages.tsx`)

### Networking / API base
- `api/client.ts` — `request<T>()` với refresh-token mutex; `API_BASE` lấy từ `EXPO_PUBLIC_API_URL` (**phải gồm hậu tố `/api`**), fallback từ Metro hostUri; `ApiError` kèm `code`/`serverMessage`/`params`, `apiErrorMessage(e, fallback)` trả thông báo đã dịch (qua `utils/resolve-error.ts`) — UI không hiện `err.message` (mã thô) nữa
- WS đều derive từ `API_BASE` (`http→ws`) trong các hook socket + `notification-context`

---

## Feed parity với Web (Phase 1→8)

Scope đã chốt: **không realtime, không story editor** — backend/web không sửa gì, chỉ port giao diện + hành vi sang mobile. (Ads sponsored đã port sau đó ở **Partner Hub Phase 7** — xem mục Partner Hub.)

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
