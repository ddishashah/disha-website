import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

export const reader = createReader(process.cwd(), keystaticConfig);

export type Post = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  cover: string | null;
  coverAlt: string;
  tags: string[];
  draft: boolean;
};

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatDate = (iso: string) => (iso ? fmt.format(new Date(iso + 'T00:00:00')) : '');

// Published posts, newest first. Drafts are hidden on the live site but visible while you edit locally (npm run dev).
export async function getPosts(): Promise<Post[]> {
  const all = await reader.collections.posts.all();
  return all
    .map(({ slug, entry }) => ({
      slug,
      title: entry.title,
      summary: entry.summary,
      date: entry.date ?? '',
      cover: entry.cover ? '/blog-img/' + entry.cover : null,
      coverAlt: entry.coverAlt || entry.title,
      tags: [...entry.tags],
      draft: entry.draft,
    }))
    .filter((p) => import.meta.env.DEV || !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
