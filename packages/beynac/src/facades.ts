import { Router } from "./contracts/Router";
import { createFacade } from "./core/facade";

export const Route: Router = createFacade(Router);
