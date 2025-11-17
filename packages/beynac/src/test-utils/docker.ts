import { spawnSync } from "node:child_process";
import path from "node:path";
import { sleep } from "../utils";

export type DockerService = "minio";

export const MINIO_ROOT_USER = "minioadmin";
export const MINIO_ROOT_PASSWORD = "minioadmin";
export const MINIO_PORT = 22855;
export const MINIO_CONSOLE_PORT = 22856;
export const MINIO_ENDPOINT: string = `http://localhost:${MINIO_PORT}`;

export function shouldSkipDockerTests(): boolean {
	return process.env.SKIP_DOCKER_INTEGRATION_TESTS === "1";
}

export async function ensureDockerServicesRunning(services: DockerService[]): Promise<void> {
	const serviceStatus = await Promise.all(
		services.map(async (service) => ({
			service,
			started: await isServiceRunning(service),
		})),
	);

	const servicesToStart = serviceStatus
		.filter((check) => !check.started)
		.map((check) => check.service);

	if (servicesToStart.length === 0) {
		return;
	}

	const packageRoot = path.resolve(__dirname, "../..");

	console.log(`Starting services [${servicesToStart.join(", ")}] using docker compose...`);

	const composeResult = spawnSync("docker", ["compose", "up", "-d", ...servicesToStart], {
		cwd: packageRoot,
		encoding: "utf-8",
	});

	if (composeResult.error || composeResult.status !== 0) {
		throw new Error(
			`Failed to start services with docker compose: ${composeResult.stderr || composeResult.error?.message}`,
		);
	}

	console.log(`Services [${servicesToStart.join(", ")}] started via docker compose`);

	await Promise.all(servicesToStart.map((service) => waitForService(service)));
}

async function isServiceRunning(service: DockerService): Promise<boolean> {
	switch (service) {
		case "minio":
			return await isMinioRunning();
	}
}

async function isMinioRunning(): Promise<boolean> {
	try {
		const response = await fetch(`${MINIO_ENDPOINT}/minio/health/live`);
		return response.ok;
	} catch {
		return false;
	}
}

async function waitForService(
	service: DockerService,
	maxWaitMs = 10000,
	delayMs = 50,
): Promise<void> {
	const serviceName = service;
	let hasLoggedWaiting = false;
	const startTime = Date.now();

	while (true) {
		if (await isServiceRunning(service)) {
			if (hasLoggedWaiting) {
				console.log(`    ☑️ ${serviceName} is ready`);
			}
			return;
		}

		if (!hasLoggedWaiting) {
			console.log(`⏱️ Waiting for ${serviceName} to be ready...`);
			hasLoggedWaiting = true;
		}

		if (Date.now() - startTime > maxWaitMs) {
			throw new Error(`${serviceName} failed to become ready within the timeout period`);
		}

		await sleep(delayMs);
	}
}
