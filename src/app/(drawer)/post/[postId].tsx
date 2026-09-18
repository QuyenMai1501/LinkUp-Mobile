import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostDetail from '@/components/post-detail';
import { feedPostCache } from '@/components/feed';

export default function PostDetailScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();

  if (!postId) return null;

  const cachedPost = feedPostCache.get(postId);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <PostDetail
        postId={postId}
        postData={cachedPost}
        onBack={() => router.back()}
        onDeleted={() => router.back()}
      />
    </SafeAreaView>
  );
}
