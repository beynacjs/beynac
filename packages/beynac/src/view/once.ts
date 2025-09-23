import { createKey, type Key } from "../keys";
import type { Component, PropsWithChildren } from "./public-types";

type OnceKey = string | number | symbol | bigint;

const onceMapKey: Key<Map<OnceKey, true> | undefined> = createKey<
  Map<OnceKey, true>
>({
  name: "OnceMap",
});

type OnceProps = PropsWithChildren<{ key: OnceKey }>;

type OnceComponent = Component<OnceProps> & {
  createComponent: (key?: OnceKey) => Component<PropsWithChildren>;
};

const OnceImpl: Component<OnceProps> = ({ children, key }, ctx) => {
  const onceMap = ctx.get(onceMapKey)!;

  if (onceMap.has(key)) {
    return null;
  }

  onceMap.set(key, true);
  return children;
};

let anonOnceCounter = 0;

const createComponent = (
  key: OnceKey = Symbol(`once-${++anonOnceCounter}`),
) => {
  const component: Component<PropsWithChildren> = ({ children }, ctx) => {
    return OnceImpl({ children, key }, ctx);
  };
  const name =
    (typeof key === "symbol" ? key.description : String(key)) || "anonymous";
  component.displayName = `Once(${name})`;
  return component;
};

export const Once: OnceComponent = Object.assign(OnceImpl, {
  createComponent,
});

export { onceMapKey };
