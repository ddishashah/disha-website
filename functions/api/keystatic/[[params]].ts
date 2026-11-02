// Sign-in and GitHub access for the blog editor (/keystatic). Runs as a Cloudflare Pages Function.
// Only the storage settings are needed here, so the full editor config is not bundled into the function.
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';

const config: any = {
  storage: { kind: 'github', repo: { owner: 'ddishashah', name: 'disha-website' }, pathPrefix: 'blog-app' },
  collections: {},
};

interface Env {
  KEYSTATIC_GITHUB_CLIENT_ID: string;
  KEYSTATIC_GITHUB_CLIENT_SECRET: string;
  KEYSTATIC_SECRET: string;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { env, request } = context;
  const handler = makeGenericAPIRouteHandler(
    { config, clientId: env.KEYSTATIC_GITHUB_CLIENT_ID, clientSecret: env.KEYSTATIC_GITHUB_CLIENT_SECRET, secret: env.KEYSTATIC_SECRET },
    { slugEnvName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG' },
  );
  const { body, headers, status } = await handler(request);
  // headers may be a list of [name, value] pairs (several Set-Cookie lines) or a plain object
  const h = new Headers(headers as any);
  return new Response(body as any, { status: status ?? 200, headers: h });
};
