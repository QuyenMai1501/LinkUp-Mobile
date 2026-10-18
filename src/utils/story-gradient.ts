const TEXT_GRADIENTS: [string, string][] = [
  ['#F9CE34', '#EE2A7B'],
  ['#6228D7', '#EE2A7B'],
  ['#12A5A1', '#0A1F44'],
  ['#FF6B6B', '#FEC89A'],
  ['#43E97B', '#38F9D7'],
];

/** Chọn gradient ổn định theo id story (hash djb2-like) — xem trước ở bar + hiển thị ở viewer. */
export function pickTextGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TEXT_GRADIENTS[h % TEXT_GRADIENTS.length];
}

export { TEXT_GRADIENTS };
