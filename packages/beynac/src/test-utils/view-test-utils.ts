import { ContainerImpl } from "../container/ContainerImpl";
import type { RenderResponseOptions } from "../view/contracts/ViewRenderer";
import { ViewRenderer } from "../view/contracts/ViewRenderer";
import { ViewRendererImpl } from "../view/ViewRendererImpl";
import type { JSXNode, RenderOptions } from "../view/view-types";

const container = new ContainerImpl();
container.singleton(ViewRenderer, ViewRendererImpl);

export const mockViewRenderer: ViewRenderer = container.get(ViewRenderer);

export const render = (node: JSXNode, options?: RenderOptions): Promise<string> => {
	return mockViewRenderer.render(node, options);
};

export const renderResponse = (
	node: JSXNode,
	options?: RenderResponseOptions,
): Promise<Response> => {
	return mockViewRenderer.renderResponse(node, options);
};

export const renderStream = (node: JSXNode, options?: RenderOptions): AsyncGenerator<string> => {
	return mockViewRenderer.renderStream(node, options);
};
