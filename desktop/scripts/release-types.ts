export type ReleaseManifest = {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  platforms: Record<
    string,
    {
      downloadUrl: string | null;
      files: string[];
    }
  >;
};
