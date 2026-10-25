// ID client sinh cho các mục tạm/định danh (vd: media_group_id gộp cụm ảnh).
// randomUUID có trên modern JS/Hermes; fallback chuỗi time+random (pattern của
// post-composer `newClientKey`).
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
