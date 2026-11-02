import { WPM } from './site';

type Node = { type?: string; children?: any[]; text?: string; level?: number; [k: string]: any };

const textOf = (n: any): string => (typeof n?.text === 'string' ? n.text : (n?.children ?? []).map(textOf).join(''));
const slugify = (t: string) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

// Gives every heading an anchor id and returns the contents list (H2 = section, H3 = sub-section)
export function withHeadingIds(doc: Node[]) {
  const seen = new Map<string, number>();
  const toc: { id: string; text: string; level: number }[] = [];
  const out = doc.map((n) => {
    if (n.type !== 'heading') return n;
    const text = textOf(n).trim();
    let id = slugify(text);
    const c = seen.get(id) ?? 0; seen.set(id, c + 1);
    if (c) id += '-' + (c + 1);
    toc.push({ id, text, level: n.level === 2 ? 2 : 3 });
    return { ...n, id };
  });
  return { doc: out, toc };
}

export function readingMinutes(doc: Node[]) {
  const words = doc.map(textOf).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WPM));
}
