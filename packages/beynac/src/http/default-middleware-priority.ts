import type { MiddlewareReference } from "./Middleware";
import { StatusPagesMiddleware } from "./StatusPagesMiddleware";

export const DEFAULT_MIDDLEWARE_PRIORITY: MiddlewareReference[] = [
	// Framework middleware will be added here
	// Examples: Session, Auth, CSRF, RateLimit, etc.
	StatusPagesMiddleware,
];
