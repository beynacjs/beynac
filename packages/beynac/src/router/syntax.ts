/**
 * Regular expression to match {param} syntax
 */
export const PARAM_PATTERN: RegExp = /\{(\w+)\}/g;

/**
 * Regular expression to match {...param} syntax (wildcard)
 */
export const WILDCARD_PARAM_PATTERN: RegExp = /\{\.\.\.(\w+)\}/g;

export function validateGroupPathSyntax(prefix: string | undefined): void {
  if (!prefix) return;

  validateRoutePathSyntax(prefix, "Group prefix");

  if (!prefix.startsWith("/")) {
    throw new Error(`Group prefix "${prefix}" must start with "/".`);
  }

  if (prefix && /\{\.\.\./.test(prefix)) {
    throw new Error(
      `Group prefix "${prefix}" contains a wildcard parameter. ` +
        `Wildcards are not allowed in group prefixes. Use them in route paths instead.`,
    );
  }
}

export function validateRoutePathSyntax(path: string | undefined, pathType = "Route path"): void {
  if (!path) return;

  if (path.includes("*")) {
    throw new Error(
      `${pathType} "${path}" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.`,
    );
  }

  if (path.includes(":")) {
    throw new Error(
      `${pathType} "${path}" contains colon characters. Use {param} syntax instead of :param.`,
    );
  }

  if (/\{[^}]+\.\.\.\}/.test(path)) {
    throw new Error(
      `${pathType} "${path}" has incorrect wildcard syntax. Use {...param} not {param...}.`,
    );
  }

  if (/\{\.\.\.(\w+)\}./.test(path)) {
    throw new Error(
      `${pathType} "${path}" has wildcard parameter in non-terminal position. ` +
        `Wildcards can only appear at the end of a path, like /files/{...path}, not /files/{...path}/something.`,
    );
  }

  if (/[^/.]\{/.test(path) || /\}[^/.]/.test(path)) {
    throw new Error(
      `${pathType} "${path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/ or /{param}text/.`,
    );
  }

  // Any remaining curly braces after extracting valid params are invalid
  const pathWithoutValidPlaceholders = path.replaceAll(/\{(\.\.\.)?\w+\}/g, "");
  if (pathWithoutValidPlaceholders.includes("{") || pathWithoutValidPlaceholders.includes("}")) {
    throw new Error(
      `${pathType} "${path}" contains invalid curly braces. ` +
        `Curly braces can only be used for parameters like {param} or {...wildcard}.`,
    );
  }
}
