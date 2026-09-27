// WebCrypto cho Hermes — React Native KHÔNG có globalThis.crypto (subtle).
// Nguồn lỗi: "Property 'crypto' doesn't exist" ném ra từ src/utils/e2ee.ts
// (ECDH P-256, HKDF, AES-GCM, PBKDF2, getRandomValues đều gọi crypto.subtle).
// TypeScript không bắt được vì expo/tsconfig.base bật lib DOM.
//
// PHẢI import là dòng ĐẦU TIÊN của src/app/_layout.tsx.

// require có điều kiện (không dùng import static): react-native-quick-crypto là
// module native, không chạy trên web — nhánh dưới không bao giờ evaluate nó
// khi runtime đã có crypto (browser).
if (typeof globalThis.crypto?.subtle !== 'object') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const QuickCrypto = require('react-native-quick-crypto').default as {
    install: () => void;
  };
  QuickCrypto.install();

  if (typeof globalThis.crypto?.subtle !== 'object' && __DEV__) {
    console.warn(
      '[polyfills] WebCrypto polyfill FAILED — e2ee sẽ vẫn throw. ' +
        'Kiểm tra react-native-quick-crypto đã build vào APK chưa.',
    );
  }
}
