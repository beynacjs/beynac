// biome-ignore-all lint/suspicious/noExplicitAny: we follow react in using any for some types here

import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types";
import type { MarkupStream } from "./markup-stream";
import type { RawContent } from "./raw";

export type Content =
	| string
	| number
	| RawContent
	| MarkupStream
	| null
	| undefined
	| boolean
	| Promise<Content>
	| Content[];

export type Chunk = [string, Promise<Chunk> | null];

export namespace JSX {
	export type Element = {
		render(): string | Promise<string>;
		renderChunks(): Chunk;
	};

	export type Children =
		| string
		| Promise<string>
		| number
		| Element
		| null
		| undefined
		| boolean
		| Children[];

	export interface ElementChildrenAttribute {
		children: Children;
	}

	export interface IntrinsicElements extends IntrinsicElementsDefined {
		[tagName: string]: AnyProps;
	}

	export interface IntrinsicAttributes {
		key?: string | number | bigint | null | undefined;
	}
}

type AnyProps = Record<string, any>;

export type Component<P = AnyProps> = (props: P) => JSX.Element | null;

export type PropsWithChildren<P = unknown> = P & {
	children?: JSX.Children | undefined;
};

// TODO get this from the csstype package
export type CSSProperties = Record<string, unknown>;
