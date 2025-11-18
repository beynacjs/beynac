import { createApplication } from "beynac";
import { filesystemStorage } from "beynac/storage";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import routes from "./routes/web";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = createApplication({
	routes,
	development: true,
	disks: {
		local: filesystemStorage({
			rootPath: join(__dirname, "storage"),
		}),
	},
});
