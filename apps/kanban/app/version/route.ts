/**
 * We force it to static because we want to cache for as long as the build is live.
 */
export const dynamic = 'force-static';

// please provide your own implementation
// if you're not using Vercel or Cloudflare Pages
const KNOWN_GIT_ENV_VARS = [
  'CF_PAGES_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'GIT_HASH',
];

export const GET = async () => {
  const currentGitHash = await getGitHash();

  return new Response(currentGitHash, {
    headers: {
      'content-type': 'text/plain',
    },
  });
};

function getGitHash() {
  for (const envVar of KNOWN_GIT_ENV_VARS) {
    if (process.env[envVar]) {
      return process.env[envVar];
    }
  }

  return getHashFromProcess();
}

async function getHashFromProcess() {
  // avoid calling a Node.js command in the edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NODE_ENV !== 'development') {
      console.warn(
        `[WARN] Could not find git hash in environment variables. Falling back to git command. Supply a known git hash environment variable to avoid this warning.`,
      );
    }

    const { execSync } = await import('child_process');

    return execSync('git log --pretty=format:"%h" -n1').toString().trim();
  }

  console.log(
    `[INFO] Could not find git hash in environment variables. Falling back to git command. Supply a known git hash environment variable to avoid this warning.`,
  );
}
