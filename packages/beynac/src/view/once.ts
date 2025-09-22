import { createKey, type Key } from "../keys";
import type { Component, PropsWithChildren } from "./public-types";

const onceMapKey: Key<Map<string, true> | undefined> = createKey<
  Map<string, true>
>({
  name: "OnceMap",
});

export const Once: Component<PropsWithChildren<{ key?: string }>> = (
  { children, key },
  ctx,
) => {
  const onceMap = ctx.get(onceMapKey)!;

  if (!key) {
    throw new Error("Once component requires a key prop");
  }

  if (onceMap.has(key)) {
    return null;
  }

  onceMap.set(key, true);
  return children;
};
Once.defaultKeyFromSourcePosition = true;

export { onceMapKey };
