import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
const config = defineConfig({
	title: "Beynac",

	description: "The missing batteries for your favourite framework",
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		siteTitle: "Beynac", // This replaces "VitePress" in the top left

		nav: [
			{ text: "Home", link: "/" },
			{ text: "Documentation", link: "/docs/" },
			{ text: "Blog", link: "/blog/" },
		],

		sidebar: [
			{
				text: "Getting Started",
				items: [
					{ text: "Introduction", link: "/docs/" },
					{ text: "Installation", link: "/docs/installation" },
				],
			},
		],

		socialLinks: [{ icon: "github", link: "https://github.com/beynacjs/beynac" }],
	},
});

// Log the config to console
console.log("VitePress Config:", JSON.stringify(config, null, 2));

export default config;
