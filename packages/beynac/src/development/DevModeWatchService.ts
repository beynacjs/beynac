import { watch, type FSWatcher } from "node:fs";
import { inject } from "../container/inject";
import { Configuration } from "../contracts/Configuration";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";

declare global {
  var __beynacWatchService: DevModeWatchService | undefined;
}

export class DevModeWatchService {
  private watchers: FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    private config: Configuration = inject(Configuration),
    private middleware: DevModeAutoRefreshMiddleware = inject(DevModeAutoRefreshMiddleware),
  ) {
    // Destroy existing instance if present
    if (globalThis.__beynacWatchService) {
      globalThis.__beynacWatchService.destroy();
    }
    globalThis.__beynacWatchService = this;

    this.startWatching();
  }

  private startWatching(): void {
    const paths = this.config.devMode?.autoRefreshPaths ?? [process.cwd()];

    console.log(`${DevModeWatchService.name} watching: ${paths.join(", ")}`);

    for (const path of paths) {
      const watcher = watch(path, { recursive: true }, (eventType, filename) => {
        this.handleFileChange(eventType, filename);
      });
      this.watchers.push(watcher);
    }
  }

  private handleFileChange(_eventType: string, filename: string | null): void {
    // Apply path pattern filter
    const pattern = this.config.devMode?.autoRefreshPathPattern ?? /\bbeynac\b/i;
    if (filename && !pattern.test(filename)) {
      return;
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    const debounceMs = this.config.devMode?.autoRefreshDebounceMs ?? 300;
    this.debounceTimer = setTimeout(() => {
      this.triggerRefresh();
      this.debounceTimer = null;
    }, debounceMs);
  }

  private triggerRefresh(): void {
    console.log("[Beynac] Files changed, refresh triggered");
    this.middleware.triggerReload();
  }

  destroy(): void {
    // Clear any pending timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Close all watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Clean up middleware listeners
    this.middleware.destroy();

    // Clear global reference if it points to this instance
    if (globalThis.__beynacWatchService === this) {
      globalThis.__beynacWatchService = undefined;
    }
  }
}
