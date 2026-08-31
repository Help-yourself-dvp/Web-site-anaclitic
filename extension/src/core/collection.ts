import type { ForumPost } from './types';
import { postKey, sortPostsChronologically } from './utils';

export function deduplicatePosts(posts: ForumPost[]): ForumPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = postKey(post);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function checkpointMatches(
  post: ForumPost,
  checkpointKey: string | null,
  checkpointUrl: string | null,
  knownKeys: string[] = [],
): boolean {
  return (
    (checkpointKey !== null && postKey(post) === checkpointKey) ||
    (checkpointUrl !== null && post.canonical_post_url === checkpointUrl) ||
    knownKeys.includes(postKey(post))
  );
}

export function unknownPosts(posts: ForumPost[], knownPosts: ForumPost[]): ForumPost[] {
  const known = new Set(knownPosts.map((post) => postKey(post)));
  return deduplicatePosts(posts).filter((post) => !known.has(postKey(post)));
}

export function latestPost(posts: ForumPost[]): ForumPost | null {
  return sortPostsChronologically(posts).at(-1) || null;
}

export function mergeKnownKeys(existing: string[], posts: ForumPost[], limit = 1000): string[] {
  return Array.from(new Set([...existing, ...posts.map((post) => postKey(post))])).slice(-limit);
}

function postReferenceId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get('p') ||
      parsed.searchParams.get('pid') ||
      parsed.hash.match(/(?:entry|post)?[-_]?(\d+)/i)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

export function likelyServicePost(post: ForumPost): boolean {
  const text = `${post.body_text} ${post.author}`.toLocaleLowerCase();
  const markers = [
    'мои ответы',
    'мои файлы',
    'настройки',
    'меню пользователя',
    'просмотр профиля',
    'найти темы пользователя',
    'найти сообщения пользователя',
    'сообщения пользователя в теме',
  ];
  const markerCount = markers.filter((marker) => text.includes(marker)).length;
  const replacementCharacters = (text.match(/�/g) || []).length;
  const mojibakeMarkers = (text.match(/(?:Р[ђџ]|С[Ђѓ]|Рµ|СЂ)/g) || []).length;
  return (
    markerCount >= 2 ||
    (post.author === 'Неизвестный автор' && markerCount >= 1) ||
    replacementCharacters >= 2 ||
    mojibakeMarkers >= 3
  );
}

export function replyContextPosts(newPosts: ForumPost[], knownPosts: ForumPost[]): ForumPost[] {
  const selectedKeys = new Set(newPosts.map((post) => postKey(post)));
  const directUrls = new Set(newPosts.flatMap((post) => post.reply_to_urls));
  const directIds = new Set([...directUrls].map(postReferenceId).filter((value): value is string => Boolean(value)));
  return knownPosts.filter((post) => {
    if (selectedKeys.has(postKey(post))) return false;
    return directUrls.has(post.canonical_post_url) || (post.post_id !== null && directIds.has(post.post_id));
  });
}
