import { Cookies as CookiesContract } from "./contracts/Cookies";
import { Headers as HeadersContract } from "./contracts/Headers";
import { KeepAlive as KeepAliveContract } from "./contracts/KeepAlive";
import { ViewRenderer as ViewRendererContract } from "./contracts/ViewRenderer";
import { createFacade } from "./core/facade";

export const KeepAlive: KeepAliveContract = createFacade(KeepAliveContract);
export const Headers: HeadersContract = createFacade(HeadersContract);
export const Cookies: CookiesContract = createFacade(CookiesContract);
export const ViewRenderer: ViewRendererContract = createFacade(ViewRendererContract);
