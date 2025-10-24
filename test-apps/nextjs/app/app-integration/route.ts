import { wrapRouteHandler } from "beynac/integrations/next";

export const GET = wrapRouteHandler(() => {
	return new Response("Hello!");
});
