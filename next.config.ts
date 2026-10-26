import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  experimental: {
    staleTimes: {
      // A page visited in the last five minutes is shown again from the
      // client cache instead of asking the server for it. The default for
      // dynamic pages is zero, which made every click in the sidebar a round
      // trip even straight back to the page just left.
      //
      // Safe here because no page renders data on the server: each one is a
      // client view that fetches through Apollo, which keeps its own cache
      // fresh. What is reused is only the page's shell.
      dynamic: 300,
    },
  },
};

export default nextConfig;
