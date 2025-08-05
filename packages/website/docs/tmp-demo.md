
This should work

```js
when(A).needs(Dep).give(token);

when(A).needs(Dep).give(AltDep);
```

so should this (it's in website folder tests)

```ts
import { inject } from "beynac";

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
```

This should not:

```ts

when(A).needs(Dep).quux(token);

```

This should be ignored as no syntax language:

```
when(A).needs(Dep).quux(token);
```
