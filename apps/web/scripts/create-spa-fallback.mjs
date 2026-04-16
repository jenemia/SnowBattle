import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distIndex = resolve(process.cwd(), "dist/index.html");
const distFallback = resolve(process.cwd(), "dist/404.html");

if (existsSync(distIndex)) {
  copyFileSync(distIndex, distFallback);
}
