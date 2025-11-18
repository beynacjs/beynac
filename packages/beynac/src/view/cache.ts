import { inject } from "../container/inject";
import { BaseComponent } from "./Component";
import type { ViewRenderer } from "./contracts/ViewRenderer";
import { ViewRenderer as ViewRendererToken } from "./contracts/ViewRenderer";
import type { Context, JSXElement, PropsWithChildren } from "./public-types";
import { tagAsJsxElement } from "./public-types";
import { RawContent } from "./raw";

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
export class Cache extends BaseComponent<CacheProps> {
	static displayName = "Cache";

	constructor(
		props: CacheProps,
		private renderer: ViewRenderer = inject(ViewRendererToken),
	) {
		super(props);
	}

	async render(context: Context): Promise<JSXElement> {
		const { map, key, children } = this.props;
		const cached = map.get(key);
		if (cached != null) {
			return tagAsJsxElement(new RawContent(cached));
		}

		const rendered = await this.renderer.render(children, { context });
		map.set(key, rendered);

		return tagAsJsxElement(new RawContent(rendered));
	}
}
