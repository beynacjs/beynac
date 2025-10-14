import { app } from "@/beynac/app";
import { RequestContext } from "beynac/contracts";
import { makeRouteHandlers } from "beynac/integrations/next";
import { cookies } from "next/headers";

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = makeRouteHandlers(app);

export const createRequestContext = (): RequestContext => {
  return {
    deleteCookie(name) {
      cookies();
    },
  };
};
