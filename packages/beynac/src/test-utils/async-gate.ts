type CheckpointFunction = (name: string) => Promise<void>;

type AsyncGate = {
	task(name: string): CheckpointFunction;
	next(): Promise<void>;
	current(taskName: string): string | null;
	run(): Promise<void>;
};

interface TaskState {
	waitingOn: string | null;
	resolver: (() => void) | null;
}

/**
 * Create a new async gate for testing synchronization between async functions.
 *
 * Example:
 *   const gate = asyncGate(['init', 'process', 'cleanup']);
 *   const checkpoint = gate.task('myTask');
 *
 *   const task = async () => {
 *     await checkpoint('init');
 *     // do work
 *     await checkpoint('process');
 *   };
 *
 *   const p = task();
 *   await gate.next(); // advance to 'init'
 *   await gate.next(); // advance to 'process'
 */
export function asyncGate(checkpoints: string[]): AsyncGate {
	if (checkpoints.length === 0) {
		throw new Error("Checkpoints array cannot be empty");
	}

	const uniqueCheckpoints = new Set(checkpoints);
	if (uniqueCheckpoints.size !== checkpoints.length) {
		throw new Error("Checkpoints array contains duplicates");
	}

	let currentIndex = -1;
	const tasks = new Map<string, TaskState>();
	const nextResolvers = new Set<() => void>();

	const task = (name: string): CheckpointFunction => {
		if (tasks.has(name)) {
			throw new Error(`Task "${name}" already exists`);
		}

		tasks.set(name, {
			waitingOn: null,
			resolver: null,
		});

		return async (checkpointName: string) => {
			const index = checkpoints.indexOf(checkpointName);
			if (index === -1) {
				throw new Error(`Unknown checkpoint: ${checkpointName}`);
			}

			const taskState = tasks.get(name);
			if (!taskState) {
				throw new Error(`Task "${name}" not found`);
			}

			// Wait until this checkpoint is current or passed
			while (currentIndex < index) {
				taskState.waitingOn = checkpointName;

				// Notify any waiting next() calls
				for (const resolve of nextResolvers) {
					resolve();
				}
				nextResolvers.clear();

				// Wait to be released
				await new Promise<void>((resolve) => {
					taskState.resolver = resolve;
				});
			}

			// Clear waiting state
			taskState.waitingOn = null;
			taskState.resolver = null;
		};
	};

	const next = async (): Promise<void> => {
		currentIndex++;

		if (currentIndex >= checkpoints.length) {
			throw new Error("No more checkpoints");
		}

		const currentCheckpoint = checkpoints[currentIndex];
		// Wait for tasks to arrive if not at last checkpoint
		if (currentIndex < checkpoints.length - 1 && tasks.size > 0) {
			// Check if we need to wait for any task to reach this checkpoint
			const isAnyTaskWaitingHere = Array.from(tasks.values()).some(
				(taskState) => taskState.waitingOn === currentCheckpoint,
			);

			if (!isAnyTaskWaitingHere) {
				// Check if any task might reach this checkpoint
				const willAnyTaskReachHere = Array.from(tasks.values()).some(
					(taskState) => {
						if (!taskState.waitingOn) {
							// Task not waiting yet - might reach this checkpoint
							return true;
						}
						// Task is waiting on this exact checkpoint
						return taskState.waitingOn === currentCheckpoint;
					},
				);

				if (willAnyTaskReachHere) {
					// Wait for a task to arrive
					await new Promise<void>((resolve) => {
						nextResolvers.add(resolve);
					});
				}
			}
		}

		// Release all tasks waiting on this checkpoint
		const tasksToRelease: Array<() => void> = [];
		for (const taskState of tasks.values()) {
			if (taskState.resolver && taskState.waitingOn === currentCheckpoint) {
				tasksToRelease.push(taskState.resolver);
				taskState.resolver = null;
			}
		}

		// Release them all at once
		tasksToRelease.forEach((resolve) => resolve());

		// Give released tasks a chance to update their state
		if (tasksToRelease.length > 0) {
			await new Promise<void>((resolve) => setTimeout(resolve, 1));
		}
	};

	const current = (taskName: string): string | null => {
		const taskState = tasks.get(taskName);
		if (!taskState) {
			throw new Error(`Unknown task: ${taskName}`);
		}
		return taskState.waitingOn;
	};

	const run = async (): Promise<void> => {
		while (currentIndex < checkpoints.length - 1) {
			await next();
		}
	};

	return {
		task,
		next,
		current,
		run,
	};
}
