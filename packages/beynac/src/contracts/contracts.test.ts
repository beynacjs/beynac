import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { basename } from "path";
import { isKey } from "../keys";

describe("Contracts", () => {
  test("each contract file exports a properly named interface and key", async () => {
    const contractsDir = __dirname;

    const files = readdirSync(contractsDir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => file !== "index.ts")
      .filter((file) => !file.endsWith(".test.ts"));

    expect(files.length).toBeGreaterThan(0);

    for (const fileName of files) {
      const contractName = basename(fileName, ".ts");

      const module = (await import(`./${fileName}`)) as Record<string, unknown>;

      const keyExport = module[contractName];

      expect(keyExport, `${fileName} should export a key called ${contractName}`).toBeDefined();
      expect(
        isKey(keyExport),
        `${contractName} value exported from ${fileName} should be a key`,
      ).toBeTrue();

      const key = keyExport as { toString(): string };
      expect(key.toString()).toBe(`[${contractName}]`);

      const content = readFileSync(`${contractsDir}/${fileName}`, "utf-8");

      expect(content).toContain(`export interface ${contractName}`);

      // Check that the contract is exported from index.ts
      const indexContent = readFileSync(`${contractsDir}/index.ts`, "utf-8");
      expect(
        indexContent,
        `${contractName} should be exported from index.ts with: export { ${contractName} } from "./${contractName}";`,
      ).toContain(`export { ${contractName} } from "./${contractName}";`);
    }
  });
});
