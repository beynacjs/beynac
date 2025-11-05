import { delete as delete_, get, group, post } from "beynac/http";
import {
	DeleteCookieController,
	EchoParamController,
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

	// API routes for param testing
	get("/beynac/api/param/{param}/test", EchoParamController),

	get("/people/{personId}", IndexController, { name: "people" }),
]);
