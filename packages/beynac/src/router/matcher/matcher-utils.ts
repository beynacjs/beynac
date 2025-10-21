import type { MatchedRoute, ParamsIndexMap } from "./types";

export const NullProtoObj = (() => {
  const e = function () {};
  return ((e.prototype = Object.create(null)), Object.freeze(e.prototype), e);
})() as unknown as { new (): any };

export function domainAndPathToSegments(domain: string | undefined, path: string): string[] {
  const [_, ...s] = path.split("/");
  const pathSegments = s[s.length - 1] === "" ? s.slice(0, -1) : s;
  if (!domain) {
    return pathSegments;
  }
  const domainSegments = domain.split(".");
  return [...domainSegments, "//", ...pathSegments];
}

export function getMatchParams(
  segments: string[],
  paramsMap: ParamsIndexMap,
): MatchedRoute["params"] {
  const params = new NullProtoObj();
  for (const [index, name] of paramsMap) {
    const segment = index < 0 ? segments.slice(-1 * index).join("/") : segments[index];
    if (typeof name === "string") {
      params[name] = segment;
    } else {
      const match = segment.match(name);
      if (match) {
        for (const key in match.groups) {
          params[key] = match.groups[key];
        }
      }
    }
  }
  return params;
}
