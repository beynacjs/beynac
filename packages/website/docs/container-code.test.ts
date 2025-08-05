import { expect, test } from "bun:test";
import { Container, inject } from "beynac";

test("", () => {
	class Controller {}
	class AppleMusic {}

	class PodcastController extends Controller {
		constructor(private apple = inject(AppleMusic)) {
			super();
		}

		/**
		 * Show information about the given podcast.
		 */
		public async process(id: string) {
			return id + String(this.apple);
			// TODO when we've implemented templates and view controllers, come back to make this real
		}
	}

	expect(new PodcastController().process("123")).toBeUndefined();

	expect(Container).not.toBe(null);
});
