import { config, fields, collection, component } from '@keystatic/core';

// Blocks you can insert into a post with "/" (the post body is a Notion-style editor)
const componentBlocks = {
  pullQuote: component({
    label: 'Pull quote',
    preview: () => null,
    schema: {
      quote: fields.text({ label: 'Quote', multiline: true }),
      by: fields.text({ label: 'Attribution (optional)' }),
    },
  }),
  callout: component({
    label: 'Callout',
    preview: () => null,
    schema: {
      title: fields.text({ label: 'Title (optional)' }),
      text: fields.text({ label: 'Text', multiline: true }),
    },
  }),
  gallery: component({
    label: 'Image gallery',
    preview: () => null,
    schema: {
      images: fields.array(
        fields.object({
          image: fields.image({ label: 'Image', directory: 'public/blog-img', publicPath: '/blog-img/' }),
          alt: fields.text({ label: 'Alt text (describe the image)' }),
          caption: fields.text({ label: 'Caption (optional)' }),
        }),
        { label: 'Images (2–3 work best)', itemLabel: (p) => p.fields.alt.value || 'Image' },
      ),
    },
  }),
  video: component({
    label: 'Video (YouTube / Vimeo)',
    preview: () => null,
    schema: {
      url: fields.url({ label: 'Video link' }),
      caption: fields.text({ label: 'Caption (optional)' }),
    },
  }),
};

export default config({
  // Locally the editor reads and writes the files on this computer. On the live site it saves straight to GitHub.
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: { owner: 'ddishashah', name: 'disha-website' }, pathPrefix: 'blog-app' }
    : { kind: 'local' },
  ui: { brand: { name: 'Disha Shah · Blog' } },
  collections: {
    posts: collection({
      label: 'Blog posts',
      slugField: 'title',
      path: 'content/posts/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' }, slug: { label: 'URL ending (letters, numbers and dashes)' } }),
        summary: fields.text({
          label: 'Summary',
          description: 'One or two sentences. Shown on the blog page and in Google results.',
          multiline: true,
        }),
        date: fields.date({ label: 'Publish date', defaultValue: { kind: 'today' } }),
        cover: fields.image({
          label: 'Cover image',
          description: 'Shown on the blog page and when the post is shared. 1600 × 900 works well.',
          directory: 'public/blog-img',
          publicPath: '/blog-img/',
        }),
        coverAlt: fields.text({ label: 'Cover image description (for accessibility)' }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags', itemLabel: (p) => p.value }),
        draft: fields.checkbox({ label: 'Draft', description: 'Tick to keep the post off the live site.', defaultValue: true }),
        body: fields.document({
          label: 'Post',
          formatting: true,
          dividers: true,
          links: true,
          tables: true,
          layouts: [[1, 1], [1, 1, 1]],
          images: { directory: 'public/blog-img', publicPath: '/blog-img/' },
          componentBlocks,
        }),
      },
    }),
  },
});
