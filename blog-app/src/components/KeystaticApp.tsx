import { Keystatic } from '@keystatic/core/ui';
import config from '../../keystatic.config';

// The editor (a single-page app). Deep links such as /keystatic/collection/posts are handled by the app itself.
export default function KeystaticApp() {
  return (
    <Keystatic
      config={config}
      appSlug={{ envName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG', value: import.meta.env.PUBLIC_KEYSTATIC_GITHUB_APP_SLUG }}
    />
  );
}
