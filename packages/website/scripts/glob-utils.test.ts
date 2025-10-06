import { expect, test } from "bun:test";
import { expandGlobPatterns } from "./glob-utils";

const testFiles = [
  "Container/Container.php",
  "Container/BoundMethod.php",
  "Container/Attributes/Auth.php",
  "View/Factory.php",
  "View/Compilers/BladeCompiler.php",
  "Database/Query/Builder.php",
  "Database/Eloquent/Model.php",
  "Routing/Console/ControllerMakeCommand.php",
  "Routing/Router.php",
  "tests/Container/ContainerTest.php",
  "tests/View/ViewTest.php",
] as const;

test("expandGlobPatterns matches directory wildcard", () => {
  const result = expandGlobPatterns(["Container/**"], testFiles);
  expect(result).toEqual([
    "Container/Container.php",
    "Container/BoundMethod.php",
    "Container/Attributes/Auth.php",
  ]);
});

test("expandGlobPatterns matches single file", () => {
  const result = expandGlobPatterns(["View/Factory.php"], testFiles);
  expect(result).toEqual(["View/Factory.php"]);
});

test("expandGlobPatterns supports negation", () => {
  const result = expandGlobPatterns(["Routing/**", "!Routing/Console/**"], testFiles);
  expect(result).toEqual(["Routing/Router.php"]);
});

test("expandGlobPatterns later patterns override earlier", () => {
  const result = expandGlobPatterns(["Container/**", "!Container/Attributes/**"], testFiles);
  expect(result).toEqual(["Container/Container.php", "Container/BoundMethod.php"]);
});

test("expandGlobPatterns matches multiple patterns", () => {
  const result = expandGlobPatterns(["Container/**", "tests/Container/**"], testFiles);
  expect(result).toEqual([
    "Container/Container.php",
    "Container/BoundMethod.php",
    "Container/Attributes/Auth.php",
    "tests/Container/ContainerTest.php",
  ]);
});

test("expandGlobPatterns throws when a non-negated pattern matches nothing", () => {
  expect(() => {
    expandGlobPatterns(["NonExistent/**"], testFiles);
  }).toThrow('Pattern "NonExistent/**" matched no files');
});

test("expandGlobPatterns throws when any pattern in array matches nothing", () => {
  expect(() => {
    expandGlobPatterns(["Container/**", "NonExistent/**"], testFiles);
  }).toThrow('Pattern "NonExistent/**" matched no files');
});

test("expandGlobPatterns allows negation patterns that match nothing", () => {
  // Negation patterns are allowed to match nothing
  const result = expandGlobPatterns(["Container/**", "!NonExistent/**"], testFiles);
  expect(result.length).toBeGreaterThan(0);
});

test("expandGlobPatterns handles star wildcard", () => {
  const result = expandGlobPatterns(["Database/*/Builder.php"], testFiles);
  expect(result).toEqual(["Database/Query/Builder.php"]);
});

test("expandGlobPatterns with overlapping patterns includes all matches", () => {
  // Both patterns match Container files - should include all (deduped)
  const result = expandGlobPatterns(["Container/**", "Container/Attributes/**"], testFiles);
  expect(result).toEqual([
    "Container/Container.php",
    "Container/BoundMethod.php",
    "Container/Attributes/Auth.php",
  ]);
});
