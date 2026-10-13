import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Local-dev-only (see src/lib/supabase/local-dev.ts): supabase-js always
  // calls {NEXT_PUBLIC_SUPABASE_URL}/rest/v1/... , but a natively-run PostgREST
  // serves everything at its own root with no path prefix (real Supabase's
  // Kong gateway is what adds /rest/v1 in front of PostgREST; there is no Kong
  // here). Only registered when LOCAL_DEV_POSTGREST_URL is set, so this is a
  // total no-op against a real Supabase project.
  // The new-invitation form moved to /create, which does not need a session.
  // Done here rather than in a page so it runs before the dashboard's sign-in
  // check: an old link should land on the form, not on the login screen.
  async redirects() {
    return [{ source: "/dashboard/new", destination: "/create", permanent: false }];
  },

  async rewrites() {
    const postgrestUrl = process.env.LOCAL_DEV_POSTGREST_URL;
    if (!postgrestUrl) return [];
    return [{ source: "/rest/v1/:path*", destination: `${postgrestUrl}/:path*` }];
  },
};

export default nextConfig;
