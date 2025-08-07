/** @jsxImportSource ./jsx */

import { expect, test } from "bun:test";

test("scratch", () => {
	expect(
		(
			<html>
				<head>
					<title>Existing</title>
					<meta name="description" content="This is a test page." />
				</head>
				<body>
					<title>Test</title>
				</body>
			</html>
		).toString(),
	).toMatchInlineSnapshot(
		`"<html><head><title>Existing</title><meta name="description" content="This is a test page."/><title>Test</title></head><body></body></html>"`,
	);
});
