import { Cookies as CookiesContract } from "./contracts/Cookies";
import { Headers as HeadersContract } from "./contracts/Headers";
import { Router } from "./contracts/Router";
import { createFacade } from "./core/facade";

export const Route: Router = createFacade(Router);
export const Headers: HeadersContract = createFacade(HeadersContract);
export const Cookies: CookiesContract = createFacade(CookiesContract);
