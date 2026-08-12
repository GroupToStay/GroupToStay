import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const approvedMetadataFields = [
  "version",
  "sha",
  "branch",
  "environment",
  "timestamp",
  "node",
  "pnpm",
];

function git(repositoryRoot, ...args) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function requireSha(value, context) {
  if (!value || !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`[provenance] ${context} requires a valid 40-character Git commit SHA.`);
  }
  return value;
}

function requireBranch(value, context) {
  if (!value?.trim()) {
    throw new Error(`[provenance] ${context} requires a Git branch/ref.`);
  }
  return value.trim();
}

function vercelEnvironment(value) {
  const environments = {
    development: "Development",
    preview: "Preview",
    production: "Production",
  };
  const environment = environments[value];
  if (!environment) {
    throw new Error("[provenance] Vercel Git builds require a recognized VERCEL_ENV.");
  }
  return environment;
}

function requireCanonicalVercelGitSource(env) {
  if (
    env.VERCEL_GIT_PROVIDER !== "github" ||
    env.VERCEL_GIT_REPO_OWNER !== "GroupToStay" ||
    env.VERCEL_GIT_REPO_SLUG !== "GroupToStay"
  ) {
    throw new Error(
      "[provenance] A Vercel build requires GitHub integration provenance for GroupToStay/GroupToStay.",
    );
  }
}

function requireCompatibleNode(value, vercel) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  if (!match) {
    throw new Error("[provenance] Build stopped because the Node.js version is invalid.");
  }

  const version = match.slice(1).map(Number);
  const minimum = vercel ? [22, 22, 2] : [22, 23, 1];
  const meetsMinimum = version.every((part, index) => {
    const previousPartsMatch = version
      .slice(0, index)
      .every((item, offset) => item === minimum[offset]);
    return !previousPartsMatch || part >= minimum[index];
  });

  if (version[0] !== 22 || !meetsMinimum) {
    const required = vercel ? ">=22.22.2 <23" : ">=22.23.1 <23";
    throw new Error(`[provenance] Node.js ${value} does not satisfy ${required}.`);
  }

  return value;
}

function readPnpmVersion(packageJson) {
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageJson.packageManager ?? "");
  if (!match) {
    throw new Error("[provenance] package.json must pin pnpm with packageManager.");
  }
  return match[1];
}

function resolveContext(repositoryRoot, env) {
  if (env.VERCEL === "1") {
    requireCanonicalVercelGitSource(env);
    return {
      sha: requireSha(env.VERCEL_GIT_COMMIT_SHA, "A Vercel Git build"),
      branch: requireBranch(env.VERCEL_GIT_COMMIT_REF, "A Vercel Git build"),
      environment: vercelEnvironment(env.VERCEL_ENV),
      vercel: true,
    };
  }

  if (env.GITHUB_ACTIONS === "true") {
    return {
      sha: requireSha(env.GITHUB_SHA, "GitHub Actions builds"),
      branch: requireBranch(
        env.GITHUB_HEAD_REF?.trim() || env.GITHUB_REF_NAME,
        "GitHub Actions builds",
      ),
      environment: "CI",
      vercel: false,
    };
  }

  if (env.BUILD_GIT_SHA != null || env.BUILD_GIT_BRANCH != null) {
    return {
      sha: requireSha(env.BUILD_GIT_SHA, "Explicit builds"),
      branch: requireBranch(env.BUILD_GIT_BRANCH, "Explicit builds"),
      environment: "Local",
      vercel: false,
    };
  }

  return {
    sha: requireSha(git(repositoryRoot, "rev-parse", "HEAD"), "Local builds"),
    branch: requireBranch(git(repositoryRoot, "branch", "--show-current"), "Local builds"),
    environment: "Local",
    vercel: false,
  };
}

export function writeBuildMetadata({
  repositoryRoot = defaultRepositoryRoot,
  env = process.env,
  now = new Date(),
  nodeVersion = process.version,
} = {}) {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const context = resolveContext(repositoryRoot, env);
  const shortSha = context.sha.slice(0, 12);
  const localOutputDirectory = resolve(repositoryRoot, ".output/public");
  const nextPublicDirectory = resolve(repositoryRoot, "public");

  const metadata = {
    version: packageJson.version || `${packageJson.name}-${shortSha}`,
    sha: context.sha,
    branch: context.branch,
    environment: context.environment,
    timestamp: now.toISOString(),
    node: requireCompatibleNode(nodeVersion, context.vercel),
    pnpm: readPnpmVersion(packageJson),
  };
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`;

  mkdirSync(localOutputDirectory, { recursive: true });
  mkdirSync(nextPublicDirectory, { recursive: true });
  writeFileSync(resolve(localOutputDirectory, "build-metadata.json"), serialized, "utf8");
  writeFileSync(resolve(nextPublicDirectory, "build-metadata.json"), serialized, "utf8");

  return metadata;
}

const invokedAsScript =
  process.argv[1] != null && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  try {
    const metadata = writeBuildMetadata();
    console.log(`[provenance] Build metadata written for ${metadata.sha.slice(0, 12)}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
