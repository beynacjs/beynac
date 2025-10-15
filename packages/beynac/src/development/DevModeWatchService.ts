import { watch, type FSWatcher } from "node:fs";
import { inject } from "../container/inject";
import { Configuration } from "../contracts/Configuration";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";

declare global {
  var __beynacWatchService: DevModeWatchService | undefined;
}

export class DevModeWatchService {
  #started = false;
  #destroyed = false;
  private watchers: FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    private config: Configuration = inject(Configuration),
    private middleware: DevModeAutoRefreshMiddleware = inject(DevModeAutoRefreshMiddleware),
  ) {}

  start(): void {
    if (this.#started || this.#destroyed) return;
    this.#started = true;

    if (globalThis.__beynacWatchService) {
      globalThis.__beynacWatchService.destroy();
    }
    globalThis.__beynacWatchService = this;

    const paths = this.config.devMode?.autoRefreshPaths ?? [process.cwd()];

    if (paths.length === 0) {
      console.log(`${DevModeWatchService.name} list of paths to watch is empty`);
    }

    console.log(`${DevModeWatchService.name} watching: ${paths.join(", ")}`);

    for (const path of paths) {
      const watcher = watch(path, { recursive: true }, (eventType, filename) => {
        this.#handleFileChange(eventType, filename);
      });
      this.watchers.push(watcher);
    }
  }

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    this.middleware.destroy();

    if (globalThis.__beynacWatchService === this) {
      globalThis.__beynacWatchService = undefined;
    }
  }

  #handleFileChange(_eventType: string, filename: string | null): void {
    if (!filename) {
      return;
    }
    const pattern = this.config.devMode?.autoRefreshPathPattern ?? /\bbeynac\b/i;
    if (!pattern.test(filename)) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceMs = this.config.devMode?.autoRefreshDebounceMs ?? 300;
    this.debounceTimer = setTimeout(() => {
      this.middleware.triggerReload();
      this.debounceTimer = null;
    }, debounceMs);
  }
}
