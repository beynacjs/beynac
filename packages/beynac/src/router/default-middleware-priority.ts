import type { MiddlewareReference } from "../core/Middleware";

/**
 * Default middleware execution priority order.
 *
 * Middleware in this list will execute in the specified order when assigned to routes,
 * regardless of the order they're specified. Middleware not in this list will execute
 * after priority middleware in their original order.
 *
 * This list will be populated as framework middleware are added.
 */
export const DEFAULT_MIDDLEWARE_PRIORITY: MiddlewareReference[] = [
  // Framework middleware will be added here
  // Examples: Session, Auth, CSRF, RateLimit, etc.
];
