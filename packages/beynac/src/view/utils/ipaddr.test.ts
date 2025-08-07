import {
	convertIPv4BinaryToString,
	convertIPv4ToBinary,
	convertIPv6BinaryToString,
	convertIPv6ToBinary,
	distinctRemoteAddr,
	expandIPv6,
} from "./ipaddr";

describe("expandIPv6", () => {
	it("Should result be valid", () => {
		expect(expandIPv6("1::1")).toBe("0001:0000:0000:0000:0000:0000:0000:0001");
		expect(expandIPv6("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
		expect(expandIPv6("2001:2::")).toBe(
			"2001:0002:0000:0000:0000:0000:0000:0000",
		);
		expect(expandIPv6("2001:2::")).toBe(
			"2001:0002:0000:0000:0000:0000:0000:0000",
		);
		expect(expandIPv6("2001:0:0:db8::1")).toBe(
			"2001:0000:0000:0db8:0000:0000:0000:0001",
		);
		expect(expandIPv6("::ffff:127.0.0.1")).toBe(
			"0000:0000:0000:0000:0000:ffff:7f00:0001",
		);
	});
});
describe("distinctRemoteAddr", () => {
	it("Should result be valid", () => {
		expect(distinctRemoteAddr("1::1")).toBe("IPv6");
		expect(distinctRemoteAddr("::1")).toBe("IPv6");
		expect(distinctRemoteAddr("::ffff:127.0.0.1")).toBe("IPv6");

		expect(distinctRemoteAddr("192.168.2.0")).toBe("IPv4");
		expect(distinctRemoteAddr("192.168.2.0")).toBe("IPv4");

		expect(distinctRemoteAddr("example.com")).toBeUndefined();
	});
});

describe("convertIPv4ToBinary", () => {
	it("Should result is valid", () => {
		expect(convertIPv4ToBinary("0.0.0.0")).toBe(0n);
		expect(convertIPv4ToBinary("0.0.0.1")).toBe(1n);

		expect(convertIPv4ToBinary("0.0.1.0")).toBe(1n << 8n);
	});
});

describe("convertIPv4ToString", () => {
	// add tons of test cases here
	test.each([
		{ input: "0.0.0.0", expected: "0.0.0.0" },
		{ input: "0.0.0.1", expected: "0.0.0.1" },
		{ input: "0.0.1.0", expected: "0.0.1.0" },
	])("convertIPv4ToString($input) === $expected", ({ input, expected }) => {
		expect(convertIPv4BinaryToString(convertIPv4ToBinary(input))).toBe(
			expected,
		);
	});
});

describe("convertIPv6ToBinary", () => {
	it("Should result is valid", () => {
		expect(convertIPv6ToBinary("::0")).toBe(0n);
		expect(convertIPv6ToBinary("::1")).toBe(1n);

		expect(convertIPv6ToBinary("::f")).toBe(15n);
		expect(convertIPv6ToBinary("1234:::5678")).toBe(
			24196103360772296748952112894165669496n,
		);
		expect(convertIPv6ToBinary("::ffff:127.0.0.1")).toBe(281472812449793n);
	});
});

describe("convertIPv6ToString", () => {
	// add tons of test cases here
	test.each([
		{ input: "::1", expected: "::1" },
		{ input: "1::", expected: "1::" },
		{ input: "1234:::5678", expected: "1234::5678" },
		{ input: "2001:2::", expected: "2001:2::" },
		{ input: "2001::db8:0:0:0:0:1", expected: "2001:0:db8::1" },
		{
			input: "1234:5678:9abc:def0:1234:5678:9abc:def0",
			expected: "1234:5678:9abc:def0:1234:5678:9abc:def0",
		},
		{ input: "::ffff:127.0.0.1", expected: "::ffff:127.0.0.1" },
	])("convertIPv6ToString($input) === $expected", ({ input, expected }) => {
		expect(convertIPv6BinaryToString(convertIPv6ToBinary(input))).toBe(
			expected,
		);
	});
});
