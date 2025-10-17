/**
 * Regular expression to match {param} syntax
 */
export const PARAM_PATTERN: RegExp = /\{(\w+)\}/g;

/**
 * Regular expression to match {...param} syntax (wildcard)
 */
export const WILDCARD_PARAM_PATTERN: RegExp = /\{\.\.\.(\w+)\}/g;

export function validateRouteSyntax(path: string): void {
  const originalPath = path;

  if (path.includes("*")) {
    throw new Error(
      `Route path "${path}" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.`,
    );
  }

  if (path.includes(":")) {
    throw new Error(
      `Route path "${path}" contains colon characters. Use {param} syntax instead of :param.`,
    );
  }

  if (/\{[^}]+\.\.\.\}/.test(path)) {
    throw new Error(
      `Route path "${path}" has incorrect wildcard syntax. Use {...param} not {param...}.`,
    );
  }

  if (/\{\.\.\.(\w+)\}./.test(path)) {
    throw new Error(
      `Route path "${path}" has wildcard parameter in non-terminal position. ` +
        `Wildcards can only appear at the end of a path, like /files/{...path}, not /files/{...path}/something.`,
    );
  }

  if (/[^/.]\{/.test(path) || /\}[^/.]/.test(path)) {
    throw new Error(
      `Route path "${path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/ or /{param}text/.`,
    );
  }

  // Any remaining curly braces after extracting valid params are invalid
  const pathWithoutValidPlaceholders = path.replaceAll(/\{(\.\.\.)?\w+\}/g, "");
  if (pathWithoutValidPlaceholders.includes("{") || pathWithoutValidPlaceholders.includes("}")) {
    throw new Error(
      `Route path "${originalPath}" contains invalid curly braces. ` +
        `Curly braces can only be used for parameters like {param} or {...wildcard}.`,
    );
  }
}
