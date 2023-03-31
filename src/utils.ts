import { minimatch } from "minimatch";

export function include(path: string, globs: string[]) {
  if (globs.length === 0) return true;
  return globs.some((glob) => minimatch(path, glob));
}

export function assert(val: any, message: string) {
  if (!val) {
    throw new Error(message);
  }
}
