/**
 * @module
 * JSX for Hono.
 */

import type { DOMAttributes } from "./base";
import {
	cloneElement,
	Fragment,
	isValidElement,
	jsx,
	memo,
	reactAPICompatVersion,
} from "./base";
import { Children } from "./children";
import { createContext, useContext } from "./context";

export {
	reactAPICompatVersion as version,
	jsx,
	memo,
	Fragment,
	Fragment as StrictMode,
	isValidElement,
	jsx as createElement,
	cloneElement,
	createContext,
	useContext,
	Children,
	type DOMAttributes,
};

export default {
	version: reactAPICompatVersion as typeof reactAPICompatVersion,
	memo: memo as typeof memo,
	Fragment: Fragment as typeof Fragment,
	StrictMode: Fragment as typeof Fragment,
	isValidElement: isValidElement as typeof isValidElement,
	createElement: jsx as typeof jsx,
	cloneElement: cloneElement as typeof cloneElement,
	createContext: createContext as typeof createContext,
	useContext: useContext as typeof useContext,
	Children: Children as typeof Children,
};

export type { JSX } from "./intrinsic-elements";
export type * from "./types";
