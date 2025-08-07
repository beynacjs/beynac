/** @jsxImportSource ../ */
import { describe, expect, it, mock } from "bun:test";
import { useState, useSyncExternalStore } from "..";

describe("useState", () => {
	it("should be rendered with initial state", () => {
		const Component = () => {
			const [state] = useState("hello");
			return <span>{state}</span>;
		};
		const template = <Component />;
		expect(template.toString()).toBe("<span>hello</span>");
	});
});

describe("useSyncExternalStore", () => {
	it("should be rendered with result of getServerSnapshot()", () => {
		const unsubscribe = mock();
		const subscribe = mock(() => unsubscribe);
		const getSnapshot = mock();
		const getServerSnapshot = mock(() => 100);
		const App = () => {
			const count = useSyncExternalStore(
				subscribe,
				getSnapshot,
				getServerSnapshot,
			);
			return <div>{count}</div>;
		};
		const template = <App />;
		expect(template.toString()).toBe("<div>100</div>");
		expect(unsubscribe).not.toBeCalled();
		expect(subscribe).not.toBeCalled();
		expect(getSnapshot).not.toBeCalled();
	});

	it("should raise an error if getServerShot() is not provided", () => {
		const App = () => {
			const count = useSyncExternalStore(mock(), mock());
			return <div>{count}</div>;
		};
		const template = <App />;
		expect(() => template.toString()).toThrowError();
	});
});
