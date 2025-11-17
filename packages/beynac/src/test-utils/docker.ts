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
	if (!isDockerAvailable()) {
		throw new Error("Docker is not available. Please start Docker to run MinIO tests.");
	}

	// Check if all services are already running and healthy
	const allServicesHealthy = await Promise.all(
		services.map((service) => isServiceRunning(service)),
	);

	if (allServicesHealthy.every((healthy) => healthy)) {
		// All services already running and healthy - silent success
		return;
	}

	// At least one service needs to be started - log what we're doing
	const packageRoot = path.resolve(__dirname, "../..");
	console.log(`Starting services [${services.join(", ")}] using docker compose...`);

	const composeResult = spawnSync("docker", ["compose", "up", "-d", ...services], {
		cwd: packageRoot,
		encoding: "utf-8",
	});

	if (composeResult.error || composeResult.status !== 0) {
		throw new Error(
			`Failed to start services with docker compose: ${composeResult.stderr || composeResult.error?.message}`,
		);
	}

	console.log(`Services [${services.join(", ")}] started via docker compose`);

	// Wait for all services to become healthy
	await Promise.all(services.map((service) => waitForService(service)));
}

function isDockerAvailable(): boolean {
	const result = spawnSync("docker", ["info"]);
	return result.status === 0;
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
	maxAttempts = 30,
	delayMs = 1000,
): Promise<void> {
	const serviceName = service;
	let hasLoggedWaiting = false;

	for (let i = 0; i < maxAttempts; i++) {
		if (await isServiceRunning(service)) {
			if (hasLoggedWaiting) {
				console.log(`${serviceName} is ready`);
			}
			return;
		}

		// Only log on first failed check (unusual - service not ready immediately)
		if (!hasLoggedWaiting) {
			console.log(`Waiting for ${serviceName} to be ready...`);
			hasLoggedWaiting = true;
		}

		await sleep(delayMs);
	}

	throw new Error(`${serviceName} failed to become ready within the timeout period`);
}
