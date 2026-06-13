export interface ProjectManifest {
  schema: 1;
  name: string;
  type: string;
  version: string;
  entry: string;
  publicDir: string;
  editor: {
    defaultScene: string;
    assetCatalog?: string;
    assetManifest: string;
    gridSize?: number;
    gridEnabled?: boolean;
    snapRotationDeg?: number;
    snapRotationEnabled?: boolean;
    snapScale?: number;
    snapScaleEnabled?: boolean;
  };
  scripts: {
    preview?: string;
    build?: string;
    package?: string;
  };
  output: {
    distDir: string;
  };
}

export interface ActiveProject {
  manifest: ProjectManifest;
  manifestPath: string;
  rootName: string;
}

let activeProjectPromise: Promise<ActiveProject> | null = null;

export async function loadActiveProject(): Promise<ActiveProject> {
  activeProjectPromise ??= fetch("/__project").then(async (response) => {
    if (!response.ok) {
      throw new Error(`Project manifest failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as ActiveProject;
  });
  return activeProjectPromise;
}

export function projectFileUrl(projectRelativePath: string): string {
  const normalized = projectRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/__project-file/${encodeURIComponent(normalized)}`;
}

export function projectPublicFileUrl(
  manifest: ProjectManifest,
  publicRelativePath: string,
): string {
  return projectFileUrl(`${manifest.publicDir}/${publicRelativePath}`);
}
