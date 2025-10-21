import { NullProtoObj } from "./matcher-utils";
import type { MatcherContext } from "./types";

/**
 * Create a new matcher context.
 */
export function createMatcher<T = unknown>(): MatcherContext<T> {
  const ctx: MatcherContext<T> = {
    root: { key: "" },
    static: new NullProtoObj(),
  };
  return ctx;
}
