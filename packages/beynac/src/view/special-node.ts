export const SPECIAL_NODE: unique symbol = Symbol("special-node");

export const isSpecialNode = (node: unknown): boolean =>
  (node as { [SPECIAL_NODE]?: boolean })?.[SPECIAL_NODE] === true;