import { app } from "@/beynac/app";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  (await cookies()).set("test", "value", { domain });
  return app.handleRequest(request);
}
