import { DocumentRenderer } from '@keystatic/core/renderer';
import type { ReactNode } from 'react';

// The post body, laid out like a case study: text sits in a narrow column, pictures and galleries break out wider.
type Node = { type?: string; component?: string; props?: any; children?: any[]; [k: string]: any };

const isStrip = (n: Node) => n.type === 'image' || (n.type === 'component-block' && (n.component === 'gallery' || n.component === 'video'));

function videoSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) { const v = u.searchParams.get('v'); return v ? `https://www.youtube-nocookie.com/embed/${v}` : null; }
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video${u.pathname}`;
  } catch {}
  return null;
}

const renderers = {
  block: {
    // H2 = section title (serif), H3 = small label, same as the case studies
    heading: ({ level, children }: { level: number; children: ReactNode }) =>
      level <= 2 ? <h3>{children}</h3> : <h4>{children}</h4>,
    blockquote: ({ children }: { children: ReactNode }) => <blockquote className="post-quote">{children}</blockquote>,
    divider: () => <hr className="post-rule" />,
  },
};

const componentBlocks = {
  pullQuote: (p: { quote: string; by: string }) => (
    <figure className="post-pull"><blockquote>{p.quote}</blockquote>{p.by ? <figcaption>{p.by}</figcaption> : null}</figure>
  ),
  callout: (p: { title: string; text: string }) => (
    <aside className="post-callout">{p.title ? <b>{p.title}</b> : null}<p>{p.text}</p></aside>
  ),
  gallery: () => null,
  video: () => null,
};

function Strip({ n }: { n: Node }) {
  if (n.type === 'image') {
    return <figure><img src={n.src} alt={n.alt || ''} loading="lazy" decoding="async" />{n.title ? <figcaption>{n.title}</figcaption> : null}</figure>;
  }
  if (n.component === 'gallery') {
    const imgs: any[] = n.props?.images ?? [];
    return (
      <div className={`post-gallery post-gallery--${Math.min(3, Math.max(1, imgs.length))}`}>
        {imgs.map((g, i) => (
          <figure key={i}><img src={g.image} alt={g.alt || ''} loading="lazy" decoding="async" />{g.caption ? <figcaption>{g.caption}</figcaption> : null}</figure>
        ))}
      </div>
    );
  }
  const src = videoSrc(n.props?.url ?? '');
  return src ? (
    <figure className="post-video">
      <div><iframe src={src} title={n.props?.caption || 'Video'} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen /></div>
      {n.props?.caption ? <figcaption>{n.props.caption}</figcaption> : null}
    </figure>
  ) : null;
}

export default function PostBody({ document }: { document: Node[] }) {
  const groups: { strip: boolean; nodes: Node[] }[] = [];
  for (const n of document) {
    const strip = isStrip(n);
    const last = groups[groups.length - 1];
    if (last && last.strip === strip) last.nodes.push(n); else groups.push({ strip, nodes: [n] });
  }
  return (
    <>
      {groups.map((g, i) =>
        g.strip ? (
          <div className="wd-strip" data-reveal key={i}>{g.nodes.map((n, k) => <Strip n={n} key={k} />)}</div>
        ) : (
          <div className="wd-text" data-reveal key={i}>
            <DocumentRenderer document={g.nodes as any} renderers={renderers as any} componentBlocks={componentBlocks as any} />
          </div>
        ),
      )}
    </>
  );
}
