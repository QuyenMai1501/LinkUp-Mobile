import { Stack } from 'expo-router';

/**
 * Nested Stack cho nhóm communities — mirror `settings/_layout.tsx`.
 * Router.push từ drawer bị expo-router hạ cấp thành NAVIGATE (không stack)
 * + backBehavior 'firstRoute' làm history sập về màn đầu → detail/create
 * phải nằm trong Stack con để back = stack pop.
 */
export default function CommunitiesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[communityId]" />
    </Stack>
  );
}
