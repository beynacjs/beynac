import type { Key } from "../keys";
import { createKey } from "../keys";

/**
 * The interface used by framework integrations to provide access to the request
 * and response
 */
export interface RequestContext {
  /**
   * A function to get a request header
   *
   * @param name The name of the header to retrieve, case-insensitive.
   * @returns The header value or null if not present in the request.
   */
  readonly getRequestHeader: (name: string) => string | null;

  /**
   * Get the value of a request cookie
   */
  readonly getRequestCookie: (name: string) => string | null;

  /**
   * A function to set a response header, or null if headers cannot be set in
   * this environment (some environments, like server actions in NextJS, don't
   * allow arbitrary headers to be set.
   *
   * Repeated calls to set the same header name should overwrite the previous
   * value. The function will not be called for Set-Cookie headers,
   * setResponseCookie will be used instead
   *
   * @param name The name of the header to set, which should be treated case-insensitively
   * @param value The value of the header to set
   * @returns `true` if the header was set successfully, `false` if the headers
   *          have already been sent
   */
  setResponseHeader: ((name: string, value: string | null) => boolean) | null;

  /**
   * Set the value of a response cookie
   *
   * @returns `true` if the Set-Cookie header was set successfully, `false` if
   *          the headers have already been sent
   */
  setResponseCookie: (name: string, value: string, options?: CookieAttributes) => boolean;
}

export const RequestContext: Key<RequestContext | undefined> = createKey<RequestContext>({
  displayName: "RequestContext",
});
