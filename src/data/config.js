import { initialConfig, isResearch } from './view.js';

export const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
export function setPath(object, path, value) {
  const keys = path.split('.');
  let node = object;
  for (const key of keys.slice(0, -1)) node = node[key] ??= {};
  node[keys.at(-1)] = value;
}
export function distinctConfig(a, b, paths) {
  return paths.some(path => JSON.stringify(getPath(a, path)) !== JSON.stringify(getPath(b, path)));
}

// Invalid values in hidden, unused controls must not corrupt saved evidence.
// Active invalid settings are rejected by validateChart before this is called.
export function snapshotConfig(data, config) {
  const saved=structuredClone(config);
  if(!isResearch(data))return saved;
  const defaults=initialConfig(data),finite=value=>Number.isFinite(value)&&Math.abs(value)<=1e6;
  for(const path of ['baseline','histogram.count','histogram.width','color.midpoint','axes.rightMin','axes.rightMax','timeWindow.start','timeWindow.end'])if(!finite(getPath(saved,path)))setPath(saved,path,getPath(defaults,path));
  if(saved.upper!==null&&!finite(saved.upper))saved.upper=null;
  if(!saved.histogram.edges.every(finite))saved.histogram.edges=[...defaults.histogram.edges];
  return saved;
}
