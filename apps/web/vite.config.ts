import { defineConfig } from "vite";

const repositorySlug = process.env.GITHUB_REPOSITORY?.split("/")[1];
const repositoryOwner = process.env.GITHUB_REPOSITORY?.split("/")[0];
const isGitHubActionsBuild = process.env.GITHUB_ACTIONS === "true";
const isUserOrOrgPagesSite =
  repositorySlug !== undefined &&
  repositoryOwner !== undefined &&
  repositorySlug.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`;

export default defineConfig({
  base:
    isGitHubActionsBuild && repositorySlug
      ? isUserOrOrgPagesSite
        ? "/"
        : `/${repositorySlug}/`
      : "/",
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  }
});
