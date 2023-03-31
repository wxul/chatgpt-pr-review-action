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

export function getPatchLineLength(patch: string) {
  if (!patch) return 0;
  let count = 1;
  let start = 0;
  const BR = "\n";
  while (start < patch.length - BR.length + 1) {
    let char = patch.slice(start, start + BR.length);
    if (char === BR) {
      count++;
      start += BR.length;
    } else {
      start++;
    }
  }
  return count;
}
