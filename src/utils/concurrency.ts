/**
 * Chạy fn trên items với tối đa `limit` job song song, GIỮ NGUYÊN thứ tự kết
 * quả (mảng trả về theo thứ tự items, mỗi phần tử là PromiseSettledResult).
 * Dùng cho upload batch nhiều ảnh: song song cho nhanh nhưng wire/echo vẫn
 * theo thứ tự chọn.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  const count = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: count }, worker));
  return results;
}
