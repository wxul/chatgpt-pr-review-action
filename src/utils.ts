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

export function generateObjectKey(obj: Record<string, any>) {
  const keys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return JSON.stringify(result);
}

/**
 * 封装promise，根据不同的参数缓存promise
 * @param func
 * @returns
 */
export function uniqPromiseWithParams<A = any, R = void>(
  func: (params: A) => Promise<R>,
  timeout = 5 * 24 * 3600
) {
  const promiseMap: Record<string, { func: Promise<R>; time: number }> = {};
  return function (params: A) {
    console.log("Map", promiseMap);
    const key = generateObjectKey(params ?? {});
    if (!promiseMap[key] || promiseMap[key].time + timeout < Date.now())
      promiseMap[key] = { func: func(params), time: Date.now() };
    return promiseMap[key].func;
  };
}
