import { Cookies } from "beynac/facades";
import { BaseController, type ControllerContext } from "beynac/http";

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export class GetCookiesController extends BaseController {
	handle() {
		const cookies = Object.fromEntries(Cookies.entries());
		return jsonResponse({ cookies });
	}
}

export class SetCookieController extends BaseController {
	async handle({ request }: ControllerContext) {
		const body = (await request.json()) as any;

		if (!body.name) {
			return jsonResponse({ error: "Cookie name is required" }, 400);
		}

		Cookies.set(body.name, body.value || "", body.options);

		return jsonResponse({
			success: true,
			cookie: { name: body.name, value: body.value, options: body.options },
		});
	}
}

export class DeleteCookieController extends BaseController {
	handle({ params }: ControllerContext) {
		const { name } = params;

		if (!name) {
			return jsonResponse({ error: "Cookie name is required" }, 400);
		}

		Cookies.delete(name);

		return jsonResponse({ success: true, deleted: name });
	}
}

export class EchoParamController extends BaseController {
	handle({ params }: ControllerContext) {
		return jsonResponse({ param: params.param });
	}
}
