import { Route } from "beynac/facades";
import { IndexController } from "../controllers/IndexController";

export default () => {
  Route.get("/beynac", IndexController);
};
