import { Cookies as CookiesContract } from "./contracts/Cookies";
import { Headers as HeadersContract } from "./contracts/Headers";
import { createFacade } from "./core/facade";

export const Headers: HeadersContract = createFacade(HeadersContract);
export const Cookies: CookiesContract = createFacade(CookiesContract);
