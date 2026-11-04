import type { PinnedArtifact } from "../src/core/stage-artifact";
export function packBuild(options: { root: string; sha: string; verifyGit?: boolean }): Promise<PinnedArtifact>;
