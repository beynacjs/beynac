import { get, group } from "beynac/router";
import { IndexController } from "../controllers/IndexController";

export default group({}, [
  get("/beynac", IndexController),

  get("/people/{personId}", IndexController, { name: "people" }),
]);
