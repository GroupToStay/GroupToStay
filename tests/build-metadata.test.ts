import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { approvedMetadataFields, writeBuildMetadata } from "../scripts/write-build-metadata.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const branch = "chore/v3-pr1-infrastructure-provenance";
const timestamp = new Date("2026-08-08T12:00:00.000Z");
const temporaryRoots: string[] = [];

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "grouptostay-provenance-"));
  temporaryRoots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "tanstack_start_ts", packageManager: "pnpm@11.7.0" }),
  );
  return root;
}

function readMetadata(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("build metadata", () => {
  it("writes the approved schema to the local/GitHub verification path", () => {
    const repositoryRoot = createRepository();

    const metadata = writeBuildMetadata({
      repositoryRoot,
      env: {
        GITHUB_ACTIONS: "true",
        GITHUB_SHA: sha,
        GITHUB_HEAD_REF: branch,
        GITHUB_REF_NAME: "2/merge",
      },
      now: timestamp,
      nodeVersion: "v24.15.0",
    });

    expect(metadata).toEqual({
      version: "tanstack_start_ts-0123456789ab",
      sha,
      branch,
      environment: "CI",
      timestamp: timestamp.toISOString(),
      node: "v24.15.0",
      pnpm: "11.7.0",
    });
    expect(Object.keys(metadata)).toEqual(approvedMetadataFields);
    expect(readMetadata(join(repositoryRoot, ".output/public/build-metadata.json"))).toEqual(
      metadata,
    );
  });

  it("uses GITHUB_REF_NAME when a push event has an empty GITHUB_HEAD_REF", () => {
    const repositoryRoot = createRepository();

    const metadata = writeBuildMetadata({
      repositoryRoot,
      env: {
        GITHUB_ACTIONS: "true",
        GITHUB_SHA: sha,
        GITHUB_HEAD_REF: "",
        GITHUB_REF_NAME: branch,
      },
      now: timestamp,
      nodeVersion: "v24.15.0",
    });

    expect(metadata.branch).toBe(branch);
  });

  it("uses a trimmed GITHUB_REF_NAME when GITHUB_HEAD_REF is whitespace", () => {
    const repositoryRoot = createRepository();

    const metadata = writeBuildMetadata({
      repositoryRoot,
      env: {
        GITHUB_ACTIONS: "true",
        GITHUB_SHA: sha,
        GITHUB_HEAD_REF: "   ",
        GITHUB_REF_NAME: `  ${branch}  `,
      },
      now: timestamp,
      nodeVersion: "v24.15.0",
    });

    expect(metadata.branch).toBe(branch);
  });

  it("rejects GitHub Actions when both branch contexts are missing or empty", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: {
          GITHUB_ACTIONS: "true",
          GITHUB_SHA: sha,
          GITHUB_HEAD_REF: "",
          GITHUB_REF_NAME: "   ",
        },
        now: timestamp,
        nodeVersion: "v24.15.0",
      }),
    ).toThrow("GitHub Actions builds requires a Git branch/ref");
  });

  it("writes identical metadata into the Next public artifact", () => {
    const repositoryRoot = createRepository();

    const metadata = writeBuildMetadata({
      repositoryRoot,
      env: {
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_PROVIDER: "github",
        VERCEL_GIT_REPO_OWNER: "GroupToStay",
        VERCEL_GIT_REPO_SLUG: "GroupToStay",
        VERCEL_GIT_COMMIT_SHA: sha,
        VERCEL_GIT_COMMIT_REF: branch,
        VERCEL_TOKEN: "must-never-be-serialized",
        NEXT_PUBLIC_SUPABASE_URL: "https://must-never-be-serialized.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "must-never-be-serialized",
      },
      now: timestamp,
      nodeVersion: "v24.15.0",
    });

    const localMetadata = readMetadata(join(repositoryRoot, ".output/public/build-metadata.json"));
    const vercelPath = join(repositoryRoot, "public/build-metadata.json");
    const vercelMetadata = readMetadata(vercelPath);
    const serialized = readFileSync(vercelPath, "utf8");

    expect(vercelMetadata).toEqual(metadata);
    expect(localMetadata).toEqual(metadata);
    expect(Object.keys(vercelMetadata)).toEqual(approvedMetadataFields);
    expect(vercelMetadata).toMatchObject({
      sha,
      branch,
      environment: "Preview",
      node: "v24.15.0",
      pnpm: "11.7.0",
    });
    expect(serialized).not.toContain("must-never-be-serialized");
  });

  it("rejects a Vercel build without the trusted Git SHA", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: {
          VERCEL: "1",
          VERCEL_ENV: "preview",
          VERCEL_GIT_PROVIDER: "github",
          VERCEL_GIT_REPO_OWNER: "GroupToStay",
          VERCEL_GIT_REPO_SLUG: "GroupToStay",
          VERCEL_GIT_COMMIT_REF: branch,
        },
      }),
    ).toThrow("A Vercel Git build requires a valid 40-character Git commit SHA");
  });

  it("rejects a Vercel build without the trusted Git branch", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: {
          VERCEL: "1",
          VERCEL_ENV: "preview",
          VERCEL_GIT_PROVIDER: "github",
          VERCEL_GIT_REPO_OWNER: "GroupToStay",
          VERCEL_GIT_REPO_SLUG: "GroupToStay",
          VERCEL_GIT_COMMIT_SHA: sha,
        },
      }),
    ).toThrow("A Vercel Git build requires a Git branch/ref");
  });

  it("rejects a manual Vercel build even when generic build provenance is present", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: {
          VERCEL: "1",
          VERCEL_ENV: "preview",
          BUILD_GIT_SHA: sha,
          BUILD_GIT_BRANCH: branch,
        },
      }),
    ).toThrow("requires GitHub integration provenance for GroupToStay/GroupToStay");
  });

  it("does not require the removed Nitro output structure", () => {
    const repositoryRoot = createRepository();

    const metadata = writeBuildMetadata({
      repositoryRoot,
      env: {
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_PROVIDER: "github",
        VERCEL_GIT_REPO_OWNER: "GroupToStay",
        VERCEL_GIT_REPO_SLUG: "GroupToStay",
        VERCEL_GIT_COMMIT_SHA: sha,
        VERCEL_GIT_COMMIT_REF: branch,
      },
      now: timestamp,
      nodeVersion: "v24.15.0",
    });

    expect(readMetadata(join(repositoryRoot, "public/build-metadata.json"))).toEqual(metadata);
  });

  it("rejects Node versions below the supported Node 24 baseline", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: { BUILD_GIT_SHA: sha, BUILD_GIT_BRANCH: branch },
        nodeVersion: "v24.14.0",
      }),
    ).toThrow("Node.js v24.14.0 does not satisfy >=24.15.0 <25");
  });

  it("rejects unsupported future Node major versions", () => {
    const repositoryRoot = createRepository();

    expect(() =>
      writeBuildMetadata({
        repositoryRoot,
        env: { BUILD_GIT_SHA: sha, BUILD_GIT_BRANCH: branch },
        nodeVersion: "v25.0.0",
      }),
    ).toThrow("Node.js v25.0.0 does not satisfy >=24.15.0 <25");
  });
});
