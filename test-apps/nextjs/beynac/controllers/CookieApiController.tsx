import { Controller, ControllerContext } from "beynac";
import { Cookies } from "beynac/facades";

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export class GetCookiesController implements Controller {
	handle() {
		const cookies = Object.fromEntries(Cookies.entries());
		return jsonResponse({ cookies });
	}
}

export class SetCookieController implements Controller {
	async handle({ request }: ControllerContext) {
		const body = (await request.json()) as {
			name: string;
			value: string;
			options?: unknown;
		};

		if (!body.name) {
			return jsonResponse({ error: "Cookie name is required" }, 400);
		}

		Cookies.set(body.name, body.value || "");

		return jsonResponse({
			success: true,
			cookie: { name: body.name, value: body.value },
		});
	}
}

export class DeleteCookieController implements Controller {
	handle({ params }: ControllerContext) {
		const { name } = params;

		if (!name) {
			return jsonResponse({ error: "Cookie name is required" }, 400);
		}

		Cookies.delete(name);

		return jsonResponse({ success: true, deleted: name });
	}
}
