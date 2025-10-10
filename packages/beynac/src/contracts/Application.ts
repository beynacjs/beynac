import { Container } from "../container";
import type { Key } from "../keys";
import { createKey } from "../keys";

/**
 * Application contract for handling HTTP requests
 */
export interface Application extends Container {
  /**
   * Handle an incoming HTTP request
   */
  handleRequest(request: Request): Promise<Response>;

  withBeynac(context: RequestContext): Response;
}

export const Application: Key<Application | undefined> = createKey<Application>({
  displayName: "Application",
});

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
  getRequestHeader: (name: string) => string | null;

  /**
   * Get the value of a request cookie
   */
  getRequestCookie: (name: string) => string | null;

  /**
   * An object with methods allowing access to the request body, or null if not
   * available in this environment (some environments, like server actions in
   * NextJS, don't allow access to the request body).
   */
  requestBody: RequestBody | null;

  /**
   * The request URL, or null if not available in this environment
   * (some environments, like server actions in NextJS, don't allow access to
   * the request URL).
   */
  url: string | null;

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

export interface RequestBody {
  /**
   * Accessing the body through arrayBuffer(), blob(), formData(), json(), or
   * text() will set this to true. Calling any of these methods a again will
   * throw because the body can only be read once.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Body/bodyUsed
   */
  readonly bodyUsed: boolean;

  /**
   * Buffer the whole response and return it as an ArrayBuffer.
   */
  readonly arrayBuffer: () => Promise<ArrayBuffer>;

  /**
   * Buffer the whole response and return it as an Blob.
   */
  readonly blob: () => Promise<Blob>;

  /**
   * Buffer the whole response and parse it as form data.
   */
  readonly formData: () => Promise<FormData>;

  /**
   * Buffer the whole response and parse it to JSON.
   */
  readonly json: () => Promise<unknown>;

  /**
   * Buffer the whole response and return it as text.
   */
  readonly text: () => Promise<string>;
}

interface CookieAttributes {
  /**
   * Send the cookie to a specific domain and all its subdomains.
   *
   * By default, the cookie will only be sent in requests to the same domain
   * that set the cookie, e.g. if `example.com`, `www.example.com` can not read
   * it. Explicitly setting the domain to `example.com` will allow subdomains to
   * read it.
   *
   * A subdomain can set a cookie for a parent domain to allow sibling domains
   * to read it, for example, `api.example.com` can set a cookie for
   * `example.com`, allowing `www.example.com` to read it.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#domaindomain-value
   */
  domain?: string | undefined;

  /**
   * Indicates the maximum lifetime of the cookie as an HTTP-date timestamp.
   * See Date for the required formatting.
   *
   * If unspecified, the cookie becomes a session cookie. A session finishes
   * when the client shuts down, after which the session cookie is removed.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate
   */
  expires?: Date | undefined;

  /**
   * Forbids JavaScript from accessing the cookie, for example, through the
   * Document.cookie property.
   *
   * IMPORTANT For security, Beynac sets this to true in production.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly
   */
  httpOnly?: boolean | undefined;

  /**
   * Indicates the number of seconds until the cookie expires. A zero or
   * negative number will expire the cookie immediately. If both Expires and
   * Max-Age are set, Max-Age has precedence.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber
   */
  maxAge?: number | undefined;

  /**
   * Indicates that the cookie should be stored using partitioned storage. Note
   * that if this is set, the Secure directive must also be set. See Cookies
   * Having Independent Partitioned State (CHIPS) for more details.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#partitioned
   */
  partitioned?: boolean | undefined;

  /**
   * Indicates the path that must exist in the requested URL for the browser to
   * send the Cookie header.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#pathpath-value
   */
  path?: string | undefined;

  /**
   * Controls whether or not a cookie is sent with cross-site requests: that is,
   * requests originating from a different site, including the scheme, from the
   * site that set the cookie. This provides some protection against certain
   * cross-site attacks, including cross-site request forgery (CSRF) attacks.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value
   */
  sameSite?: true | false | "lax" | "strict" | "none" | undefined;

  /**
   * Indicates that the cookie is sent to the server only when a request is made
   * with the https: scheme (except on localhost), and therefore, is more
   * resistant to man-in-the-middle attacks.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure
   */
  secure?: boolean | undefined;
}
