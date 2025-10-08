import { expect, test } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import config from "../.vitepress/config.mts";

const docsPath = join(import.meta.dir, "..", "docs");

interface NavItem {
  text?: string;
  link?: string;
  items?: NavItem[];
}

function validateLinks(items: NavItem[] | undefined, pathPrefix = "") {
  if (!items) return;

  for (const item of items) {
    if (item.link?.startsWith("/docs/")) {
      let relativePath = item.link.replace(/^\/docs\//, "");
      if (relativePath === "") relativePath = "index";
      const filePath = join(docsPath, `${relativePath}.md`);

      expect(
        existsSync(filePath),
        `${pathPrefix}${item.text || item.link}: expected file ${filePath}`,
      ).toBe(true);
    }

    if (item.items) {
      validateLinks(item.items, `${pathPrefix}${item.text} > `);
    }
  }
}

test("all nav links point to existing files", () => {
  validateLinks(config.themeConfig?.nav as NavItem[], "nav > ");
});

test("all sidebar links point to existing files", () => {
  const sidebar = config.themeConfig?.sidebar as Record<string, NavItem[]> | undefined;
  if (sidebar) {
    for (const [path, items] of Object.entries(sidebar)) {
      validateLinks(items, `sidebar[${path}] > `);
    }
  }
});
