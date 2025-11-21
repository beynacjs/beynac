import { ApplicationImpl } from "./ApplicationImpl";
import type { Application } from "./contracts/Application";
import type { Configuration } from "./contracts/Configuration";
import { setFacadeApplication } from "./facade";

/***/
export const createApplication = <RouteParams extends Record<string, string> = {}>(
	config: Configuration<RouteParams> = {},
): Application<RouteParams> => {
	const app = new ApplicationImpl<RouteParams>(config);
	setFacadeApplication(app);
	app.bootstrap();
	return app;
};
