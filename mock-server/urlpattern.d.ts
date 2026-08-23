// This TypeScript lib version doesn't ship URLPattern types yet, though Bun implements
// the runtime API. Minimal ambient declaration covering just what server.ts uses.
declare class URLPattern {
  constructor(init: { pathname: string });
  exec(input: string | URL): { pathname: { groups: Record<string, string | undefined> } } | null;
}
