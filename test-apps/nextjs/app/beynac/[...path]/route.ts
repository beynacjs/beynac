import { makeRouteHandlers } from "beynac/integrations/next";
import { app } from "@/beynac/app";

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = makeRouteHandlers(app);
