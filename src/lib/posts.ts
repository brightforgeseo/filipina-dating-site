import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebase } from './firebase';

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  groupId?: string | null;
  groupName?: string;
  createdAt: any;
};

export type PostComment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: any;
};

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadPostMedia(userId: string, file: File): Promise<{ imageUrl?: string; videoUrl?: string }> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('not-media');
  if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error('too-large');
  if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error('too-large');
  const { storage } = firebase();
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : isVideo ? 'mp4' : 'jpg';
  const r = ref(storage, `post_media/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type });
  const url = await getDownloadURL(r);
  return isVideo ? { videoUrl: url } : { imageUrl: url };
}

export async function createPost(
  author: { id: string; name: string; photo?: string },
  content: { text?: string; imageUrl?: string; videoUrl?: string },
  group?: { id: string; name: string }
): Promise<Post> {
  const { db } = firebase();
  const payload: Record<string, any> = {
    authorId: author.id,
    authorName: author.name,
    // null (not missing) so equality queries can target the main feed.
    groupId: group?.id ?? null,
    createdAt: serverTimestamp(),
  };
  if (group) payload.groupName = group.name;
  if (author.photo) payload.authorPhoto = author.photo;
  if (content.text?.trim()) payload.text = content.text.trim();
  if (content.imageUrl) payload.imageUrl = content.imageUrl;
  if (content.videoUrl) payload.videoUrl = content.videoUrl;
  const refDoc = await addDoc(collection(db, 'posts'), payload);
  return { id: refDoc.id, ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } } as Post;
}

// Main feed: every non-group post (older posts predate the groupId field,
// so filter client-side rather than querying on it).
export async function listPosts(max = 30): Promise<Post[]> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(max * 2)));
  const out: Post[] = [];
  snap.forEach((d) => {
    const p = { id: d.id, ...(d.data() as any) } as Post;
    if (!p.groupId) out.push(p);
  });
  return out.slice(0, max);
}

export async function listGroupPosts(groupId: string, max = 30): Promise<Post[]> {
  const { db } = firebase();
  const snap = await getDocs(
    query(collection(db, 'posts'), where('groupId', '==', groupId), orderBy('createdAt', 'desc'), limit(max))
  );
  const out: Post[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  return out;
}

export async function deletePost(postId: string) {
  const { db } = firebase();
  await deleteDoc(doc(db, 'posts', postId));
}

export async function getLikeInfo(postId: string, userId: string): Promise<{ count: number; likedByMe: boolean }> {
  const { db } = firebase();
  const [countSnap, mine] = await Promise.all([
    getCountFromServer(collection(db, 'posts', postId, 'likes')),
    getDoc(doc(db, 'posts', postId, 'likes', userId)),
  ]);
  return { count: countSnap.data().count, likedByMe: mine.exists() };
}

export async function setLiked(postId: string, userId: string, liked: boolean) {
  const { db } = firebase();
  const r = doc(db, 'posts', postId, 'likes', userId);
  if (liked) await setDoc(r, { createdAt: serverTimestamp() });
  else await deleteDoc(r);
}

export async function getCommentCount(postId: string): Promise<number> {
  const { db } = firebase();
  const snap = await getCountFromServer(collection(db, 'posts', postId, 'comments'));
  return snap.data().count;
}

export async function listComments(postId: string): Promise<PostComment[]> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(100)));
  const out: PostComment[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  return out;
}

export async function addComment(postId: string, author: { id: string; name: string }, text: string): Promise<PostComment> {
  const { db } = firebase();
  const payload = {
    authorId: author.id,
    authorName: author.name,
    text: text.trim(),
    createdAt: serverTimestamp(),
  };
  const r = await addDoc(collection(db, 'posts', postId, 'comments'), payload);
  return { id: r.id, ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
}
