import { createFacade } from "./core/facade";
import { Cookies as CookiesContract } from "./http/contracts/Cookies";
import { Headers as HeadersContract } from "./http/contracts/Headers";
import { KeepAlive as KeepAliveContract } from "./http/contracts/KeepAlive";
import { ViewRenderer as ViewRendererContract } from "./view/contracts/ViewRenderer";

export const KeepAlive: KeepAliveContract = createFacade(KeepAliveContract);
export const Headers: HeadersContract = createFacade(HeadersContract);
export const Cookies: CookiesContract = createFacade(CookiesContract);
export const ViewRenderer: ViewRendererContract = createFacade(ViewRendererContract);
