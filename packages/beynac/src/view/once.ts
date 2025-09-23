import { createKey, type Key } from "../keys";
import type { ContextImpl } from "./context";
import type {
  Component,
  JSXNode,
  PropsWithChildren,
} from "./public-types";

type OnceKey = string | number | symbol | bigint;

export class OnceMarker {
  constructor(
    public readonly key: OnceKey,
    public readonly children: JSXNode,
    public readonly context: ContextImpl,
  ) {}
}

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
  // Instead of checking the map here, return a marker that will be
  // processed during the render phase to ensure document order
  return new OnceMarker(key, children, ctx as ContextImpl);
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
