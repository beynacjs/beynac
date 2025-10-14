import { app } from "@/beynac/app";
import { makeRouteHandlers } from "beynac/integrations/next";

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = makeRouteHandlers(app);
