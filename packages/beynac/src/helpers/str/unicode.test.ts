import { describe, expect, test } from "bun:test";
import { slug, transliterate, withoutMarks } from "./unicode";

describe(withoutMarks, () => {
	test("removes accents from French text", () => {
		expect(withoutMarks("Crème Brûlée")).toBe("Creme Brulee");
	});

	test("removes accents from single word", () => {
		expect(withoutMarks("café")).toBe("cafe");
	});

	test("decomposes ligatures", () => {
		expect(withoutMarks("ﬁle")).toBe("file");
	});

	test("handles already ASCII text", () => {
		expect(withoutMarks("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		expect(withoutMarks("")).toBe("");
	});

	test("handles mixed accented characters", () => {
		expect(withoutMarks("àáâãäåèéêëìíîïòóôõöùúûü")).toBe("aaaaaaeeeeiiiiooooouuuu");
	});

	test("preserves case", () => {
		expect(withoutMarks("CAFÉ")).toBe("CAFE");
	});

	test("removes Devanagari vowel signs (Mark but not Diacritic)", () => {
		// Devanagari vowel sign AA (U+093E) is Spacing_Mark (Mc), not in \p{Diacritic}
		expect(withoutMarks("का")).toBe("क");
	});
});

describe(transliterate, () => {
	test("converts German umlauts with multi-character expansion", () => {
		expect(transliterate("Größe")).toBe("Groesse");
	});

	test("converts German ß to ss", () => {
		expect(transliterate("Straße")).toBe("Strasse");
	});

	test("imported", () => {
		expect(transliterate("Я люблю единорогов")).toBe("Ya lyublyu edinorogov");
		expect(transliterate("'أنا أحب حيدات'")).toBe("'ana ahb hydat'");
		expect(transliterate("tôi yêu những chú kỳ lân")).toBe("toi yeu nhung chu ky lan");
		expect(transliterate("En–dashes and em—dashes are normalized")).toBe(
			"En-dashes and em-dashes are normalized",
		);
		expect(transliterate("Fußgängerübergänge")).toBe("Fussgaengeruebergaenge");
	});

	test("converts all German umlauts", () => {
		expect(transliterate("äöü ÄÖÜ ß")).toBe("aeoeue AeOeUe ss");
	});

	test("converts ligatures", () => {
		expect(transliterate("æther")).toBe("aether");
		expect(transliterate("Æon")).toBe("AEon");
		expect(transliterate("œuvre")).toBe("oeuvre");
	});

	test("converts emoji", () => {
		expect(transliterate("💯")).toBe("100");
	});

	test("converts currency symbols", () => {
		expect(transliterate("€50")).toBe("E50");
		expect(transliterate("¥100")).toBe("Y100");
	});

	test("handles already ASCII text", () => {
		expect(transliterate("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		expect(transliterate("")).toBe("");
	});

	test("converts Nordic characters", () => {
		expect(transliterate("Ø")).toBe("O");
		expect(transliterate("Å")).toBe("A");
	});

	test("converts Icelandic thorn", () => {
		expect(transliterate("Þ")).toBe("TH");
		expect(transliterate("þ")).toBe("th");
	});

	test("preserves characters not in table", () => {
		expect(transliterate("hello")).toBe("hello");
		expect(transliterate("123")).toBe("123");
	});

	test("handles multi-character Russian sequences", () => {
		// Russian: ъе → ye, Ъе → Ye (note: Ъ + е, not Ъ + Е)
		expect(transliterate("подъезд")).toBe("podyezd"); // под + ъе + зд
		expect(transliterate("Подъезд")).toBe("Podyezd"); // Под + ъе + зд (lowercase е)
		expect(transliterate("ПодЪезд")).toBe("PodYezd"); // Под + Ъе + зд (capital Ъ)
		expect(transliterate("белый")).toBe("beliy"); // бел + ый
		expect(transliterate("Белый")).toBe("Beliy"); // Бел + ый (lowercase ый)
		expect(transliterate("БелЫй")).toBe("BelIy"); // Бел + Ый (capital Ы)
	});

	test("handles Arabic diacritics with invisible characters", () => {
		// Arabic combining marks that include LTR mark (U+200E)
		expect(transliterate("مَ‎")).toBe("ma"); // م + َ‎ (fatha with LTR mark)
		expect(transliterate("مِ‎")).toBe("mi"); // م + ِ‎ (kasra with LTR mark)
	});
});

describe(slug, () => {
	// Basic whitespace handling
	test("replaces spaces with separator", () => {
		expect(slug("hello world")).toBe("hello-world");
	});

	test("collapses multiple spaces", () => {
		expect(slug("hello  world")).toBe("hello-world");
	});

	test("trims whitespace from ends", () => {
		expect(slug("  hello world  ")).toBe("hello-world");
	});

	test("normalizes various whitespace types", () => {
		expect(slug("hello\nworld")).toBe("hello-world");
		expect(slug("hello\tworld")).toBe("hello-world");
	});

	test("runs of spaces become single separator", () => {
		expect(slug("a    b")).toBe("a-b");
	});

	// Default dictionary replacements
	test("default dictionary: @, &, %, +", () => {
		expect(slug("A@B&C%D+E")).toBe("a-at-b-and-c-percent-d-plus-e");
	});

	test("replacements get spaces around them", () => {
		expect(slug("100%test")).toBe("100-percent-test");
		expect(slug("user@host")).toBe("user-at-host");
	});

	// Options: custom replacements
	test("options.replacements with custom object", () => {
		expect(slug("x@y%z", { replacements: { "%": "pct" } })).toBe("xy-pct-z");
	});

	test("options.replacements with true uses defaults", () => {
		expect(slug("x@y&z%w", { replacements: true })).toBe("x-at-y-and-z-percent-w");
	});

	test("options.replacements with false disables replacements", () => {
		expect(slug("x@y&z%w", { replacements: false })).toBe("xyzw");
	});

	// Options: separator
	test("options.separator", () => {
		expect(slug("hello world", { separator: "_" })).toBe("hello_world");
		expect(slug("foo-bar", { separator: "_" })).toBe("foo-bar"); // hyphen is URL-safe, preserved
	});

	// Options: transliterate
	test("options.transliterate control", () => {
		// Without transliterate, ö is decomposed by withoutMarks to o+diaeresis, then diaeresis removed
		// ß is removed by forceAscii
		expect(slug("Größe", { transliterate: false })).toBe("groe");
		// With transliterate, ö→oe and ß→ss happen
		expect(slug("Größe", { transliterate: true })).toBe("groesse");
	});

	// Options: withoutMarks
	test("options.withoutMarks control", () => {
		// withoutMarks removes combining marks via NFKD normalization
		// Need transliterate:false to prevent é being converted to e via replacement table
		expect(slug("café", { transliterate: false, withoutMarks: false, keep: "all" })).toBe("café");
		expect(slug("café", { transliterate: false, withoutMarks: true, keep: "all" })).toBe("cafe");
		// With keep:'urlsafe', non-ASCII gets removed anyway
		expect(slug("café", { transliterate: false, withoutMarks: false, keep: "urlsafe" })).toBe(
			"caf",
		);
		expect(slug("café", { transliterate: false, withoutMarks: true, keep: "urlsafe" })).toBe(
			"cafe",
		);
	});

	// Options: keep
	test("keep: 'urlsafe' removes URL reserved characters", () => {
		expect(slug("hello! world?")).toBe("hello-world");
		expect(slug("foo*bar")).toBe("foobar");
		expect(slug("path/to/file")).toBe("path-to-file");
	});

	test("keep: 'urlsafe' keeps unreserved URL characters", () => {
		expect(slug("hello-world")).toBe("hello-world");
		expect(slug("foo_bar")).toBe("foo_bar");
		expect(slug("test.file")).toBe("test.file");
		expect(slug("hello~world")).toBe("hello~world");
	});

	test("keep: 'urlsafe' removes non-ASCII", () => {
		expect(slug("café", { transliterate: false, withoutMarks: false })).toBe("caf");
	});

	test("keep: 'ascii' keeps ASCII special characters", () => {
		expect(slug("hello!world", { keep: "ascii", replacements: false })).toBe("hello!world");
		expect(slug("foo*bar", { keep: "ascii", replacements: false })).toBe("foo*bar");
		expect(slug("test(123)", { keep: "ascii", replacements: false })).toBe("test(123)");
	});

	test("keep: 'ascii' removes non-ASCII characters", () => {
		expect(slug("café", { keep: "ascii", transliterate: false, withoutMarks: false })).toBe("caf");
		expect(
			slug("Größe", {
				keep: "ascii",
				transliterate: false,
				withoutMarks: false,
				lowercase: false,
			}),
		).toBe("Gre");
	});

	test("keep: 'all' keeps all characters including non-ASCII", () => {
		expect(slug("café!", { keep: "all", transliterate: false, withoutMarks: false })).toBe("café!");
		expect(slug("Größe*test", { keep: "all", transliterate: false, withoutMarks: false })).toBe(
			"größe*test",
		);
		expect(slug("hello world", { keep: "all" })).toBe("hello-world"); // spaces still become separator
	});

	test("keep: 'all' with transliteration still works", () => {
		expect(slug("café!", { keep: "all" })).toBe("cafe!");
		expect(slug("Größe", { keep: "all" })).toBe("groesse");
	});

	// Options: lowercase
	test("options.lowercase control", () => {
		expect(slug("Hello World", { lowercase: false })).toBe("Hello-World");
	});

	// Intra-word marks (removed without space)
	test("removes quotes and apostrophes", () => {
		expect(slug("don't")).toBe("dont");
		expect(slug('it\'s "quoted"')).toBe("its-quoted");
		expect(slug('"hello"')).toBe("hello");
		expect(slug("café's")).toBe("cafes");
	});

	// Inter-word marks (replaced with space)
	test("replaces em/en dash with space", () => {
		expect(slug("hello—world")).toBe("hello-world");
		expect(slug("hello–world")).toBe("hello-world");
	});

	test("replaces slash/pipe/semicolon with space", () => {
		expect(slug("path/to/file")).toBe("path-to-file");
		expect(slug("A|B")).toBe("a-b");
		expect(slug("foo;bar")).toBe("foo-bar");
	});

	// Other character handling
	test("preserves numbers", () => {
		expect(slug("test 123 example")).toBe("test-123-example");
	});

	test("removes other special characters", () => {
		expect(slug("foo!bar")).toBe("foobar");
	});

	// Edge cases
	test("handles empty string", () => {
		expect(slug("")).toBe("");
	});

	test("handles only special characters", () => {
		expect(slug("!!!")).toBe("");
		expect(slug("@@@", { replacements: {} })).toBe("");
	});

	// Documentation examples
	test("all examples from doc comment work correctly", () => {
		expect(slug("Größe café")).toBe("groesse-cafe");
		expect(slug("hello  world")).toBe("hello-world");
		expect(slug("email@example")).toBe("email-at-example");
		expect(slug("Tom & Jerry")).toBe("tom-and-jerry");
		expect(slug("100%")).toBe("100-percent");
		expect(slug("hello world", { separator: "_" })).toBe("hello_world");
		expect(slug("100%", { replacements: { "%": "pct" } })).toBe("100-pct");
		expect(slug("Größe", { transliterate: false })).toBe("groe");
		expect(slug("Größe", { transliterate: false, keep: "all" })).toBe("große");
		expect(slug("Größe", { withoutMarks: false })).toBe("groesse");
		expect(slug("café!", { keep: "urlsafe" })).toBe("cafe");
		expect(slug("café!", { keep: "ascii", replacements: false })).toBe("cafe!");
		expect(slug("café!", { keep: "all", transliterate: false, withoutMarks: false })).toBe("café!");
		expect(slug("Hello", { lowercase: false })).toBe("Hello");
	});

	// Complex integration tests
	test("handles complex mixed content", () => {
		expect(slug("Crème Brûlée @ €50!")).toBe("creme-brulee-at-e50");
		expect(slug("Tom & Jerry—The Movie!")).toBe("tom-and-jerry-the-movie");
		expect(slug('100% "success" rate')).toBe("100-percent-success-rate");
	});

	test("multiple options combined", () => {
		expect(
			slug("Größe 100%", {
				separator: "_",
				replacements: { "%": "pct" },
				lowercase: false,
			}),
		).toBe("Groesse_100_pct");
	});
});
