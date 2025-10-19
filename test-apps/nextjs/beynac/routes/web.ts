import { delete as delete_, get, group, post } from "beynac/router";
import {
  DeleteCookieController,
  GetCookiesController,
  SetCookieController,
} from "../controllers/CookieApiController";
import { IndexController } from "../controllers/IndexController";

export default group({}, [
  get("/beynac", IndexController),

  // API routes for cookie testing
  get("/beynac/api/cookies", GetCookiesController),
  post("/beynac/api/cookies", SetCookieController),
  delete_("/beynac/api/cookies/{name}", DeleteCookieController),

  get("/people/{personId}", IndexController, { name: "people" }),
]);
