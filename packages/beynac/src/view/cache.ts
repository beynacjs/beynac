import { ContainerImpl } from "../container/ContainerImpl";
import type { Component } from "./Component";
import type { PropsWithChildren } from "./public-types";
import { tagAsJsxElement } from "./public-types";
import { RawContent } from "./raw";
import { ViewRendererImpl } from "./ViewRendererImpl";

type CacheProps = PropsWithChildren<{
	map: Map<string, string>;
	key: string;
}>;

/**
 * PoC to check that the rendering design can support child renders.
 *
 * Cache component that renders and caches content based on a key.
 * If the key exists in the map, returns the cached rendered content.
 * Otherwise, renders the children and caches the result.
 *
 * @example
 * ```tsx
 * const cache = new Map<string, string>();
 * <Cache map={cache} key="header">
 *   <ExpensiveComponent />
 * </Cache>
 * ```
 */
export const Cache: Component<CacheProps> = async ({ map, key, children }, context) => {
	const cached = map.get(key);
	if (cached != null) {
		return tagAsJsxElement(new RawContent(cached));
	}

	// TODO: When component injection is implemented, inject the real container instead of creating a new empty one
	const renderer = new ViewRendererImpl(new ContainerImpl());
	const rendered = await renderer.render(children, { context });
	map.set(key, rendered);

	return tagAsJsxElement(new RawContent(rendered));
};
Cache.displayName = "Cache";
