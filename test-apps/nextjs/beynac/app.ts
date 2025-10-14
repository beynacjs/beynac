import { createApplication } from "beynac";
import routes from "./routes/web";

export const app = createApplication({
  routes,
});
