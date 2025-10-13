import { app } from "@/beynac/app";
import { Route } from "beynac/facades";
import { NextRequest } from "next/server";

class MyController {
  handle() {}
}

Route.get("/path/:foo", [MyController, "handle"]);

export async function GET(request: NextRequest) {
  return await app.handleRequest(request);
}
