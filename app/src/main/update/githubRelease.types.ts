export type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

export type GitHubReleaseResponse = {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
};
