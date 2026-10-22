/**
 * Link web production để copy chia sẻ (Web dùng window.location.origin).
 */
export const WEB_ORIGIN = 'https://linkup.io.vn';

/** Link xem bài viết trên web. */
export const postLink = (postId: string) => `${WEB_ORIGIN}/posts/${postId}`;
