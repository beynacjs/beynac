import type {
	StorageDirectory,
	StorageDisk,
	StorageFile,
	StorageFileInfo,
	StorageFilePutPayload,
} from "../contracts/Storage";
import { BeynacEvent } from "../event";
import type { StorageError } from "./storage-errors";

/**
 * Operation types for storage events
 */
export type StorageOperationType =
	| "file:read"
	| "file:existence-check"
	| "file:info-retrieve"
	| "file:url-generate"
	| "file:write"
	| "file:delete"
	| "file:copy"
	| "file:move"
	| "directory:existence-check"
	| "directory:files-list"
	| "directory:directories-list"
	| "directory:delete";

/**
 * Base class for all storage events
 */
export abstract class StorageEvent extends BeynacEvent {
	abstract readonly type: StorageOperationType;

	constructor(
		public readonly disk: StorageDisk,
		public readonly path: string,
	) {
		super();
	}

	protected override getToStringExtra(): string {
		return `${this.disk.name}:${this.path}`;
	}
}

/**
 * Base class for all "starting" operation events
 */
export abstract class StorageOperationStartingEvent extends StorageEvent {
	readonly phase = "start" as const;
	public readonly startTimestamp: number = Date.now();
}

/**
 * Base class for all "completed" operation events
 */
export abstract class StorageOperationCompletedEvent extends StorageEvent {
	readonly phase = "complete" as const;
	public readonly timeTakenMs: number;

	constructor(startEvent: StorageOperationStartingEvent) {
		super(startEvent.disk, startEvent.path);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
	}
}

/**
 * Event dispatched when any storage operation fails
 */
export class StorageOperationFailedEvent extends StorageEvent {
	readonly phase = "fail" as const;
	public readonly timeTakenMs: number;
	public readonly type: StorageOperationType;

	constructor(
		public readonly startEvent: StorageOperationStartingEvent,
		public readonly error: StorageError,
	) {
		super(startEvent.disk, startEvent.path);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
		this.type = startEvent.type;
	}
}

// ============================================================================
// File Read Operations
// ============================================================================

export class FileReadingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:read" as const;
}

export class FileReadEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:read" as const;
	readonly #response: Response;
	#headers?: Headers;

	constructor(startEvent: FileReadingEvent, response: Response) {
		super(startEvent);
		this.#response = response;
	}

	get status(): number {
		return this.#response.status;
	}

	get headers(): Headers | undefined {
		if (!this.#headers) {
			this.#headers = new Headers(this.#response.headers);
		}
		return this.#headers;
	}

	/**
	 * Get a clone of the response so that you can access the response body.
	 */
	cloneResponse(): Response {
		return this.#response.clone() as Response;
	}
}

export class FileExistenceCheckingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:existence-check" as const;
}

export class FileExistenceCheckedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:existence-check" as const;

	constructor(
		startEvent: FileExistenceCheckingEvent,
		public readonly exists: boolean,
	) {
		super(startEvent);
	}
}

export class FileInfoRetrievingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:info-retrieve" as const;
}

export class FileInfoRetrievedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:info-retrieve" as const;

	constructor(
		startEvent: FileInfoRetrievingEvent,
		public readonly info: StorageFileInfo | null,
	) {
		super(startEvent);
	}
}

export class FileUrlGeneratingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:url-generate" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly urlType: "url" | "signed" | "upload",
		public readonly options?: {
			expires?: string | Date;
			downloadAs?: string;
		},
	) {
		super(disk, path);
	}
}

export class FileUrlGeneratedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:url-generate" as const;

	readonly #startEvent: FileUrlGeneratingEvent;

	constructor(
		startEvent: FileUrlGeneratingEvent,
		public readonly url: string,
	) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get urlType(): "url" | "signed" | "upload" {
		return this.#startEvent.urlType;
	}

	get options():
		| {
				expires?: string | Date;
				downloadAs?: string;
		  }
		| undefined {
		return this.#startEvent.options;
	}
}

// ============================================================================
// File Write Operations
// ============================================================================

export class FileWritingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:write" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly data: StorageFilePutPayload["data"],
		public readonly mimeType: string,
	) {
		super(disk, path);
	}
}

export class FileWrittenEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:write" as const;

	readonly #startEvent: FileWritingEvent;

	constructor(startEvent: FileWritingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get data(): StorageFilePutPayload["data"] {
		return this.#startEvent.data;
	}

	get mimeType(): string {
		return this.#startEvent.mimeType;
	}
}

export class FileDeletingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:delete" as const;
}

export class FileDeletedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:delete" as const;
}

export class FileCopyingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:copy" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly destinationDiskName: string,
		public readonly destinationPath: string,
	) {
		super(disk, path);
	}
}

export class FileCopiedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:copy" as const;

	readonly #startEvent: FileCopyingEvent;

	constructor(startEvent: FileCopyingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get destinationDiskName(): string {
		return this.#startEvent.destinationDiskName;
	}

	get destinationPath(): string {
		return this.#startEvent.destinationPath;
	}
}

export class FileMovingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:move" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly destinationDiskName: string,
		public readonly destinationPath: string,
	) {
		super(disk, path);
	}
}

export class FileMovedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:move" as const;

	readonly #startEvent: FileMovingEvent;

	constructor(startEvent: FileMovingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get destinationDiskName(): string {
		return this.#startEvent.destinationDiskName;
	}

	get destinationPath(): string {
		return this.#startEvent.destinationPath;
	}
}

// ============================================================================
// Directory Read Operations
// ============================================================================

export class DirectoryExistenceCheckingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:existence-check" as const;
}

export class DirectoryExistenceCheckedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:existence-check" as const;

	constructor(
		startEvent: DirectoryExistenceCheckingEvent,
		public readonly exists: boolean,
	) {
		super(startEvent);
	}
}

export class DirectoryListingFilesEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:files-list" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly recursive: boolean,
	) {
		super(disk, path);
	}
}

export class DirectoryFilesListedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:files-list" as const;
	readonly #startEvent: DirectoryListingFilesEvent;

	constructor(
		startEvent: DirectoryListingFilesEvent,
		public readonly files: StorageFile[],
	) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get recursive(): boolean {
		return this.#startEvent.recursive;
	}
}

export class DirectoryListingDirectoriesEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:directories-list" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly recursive: boolean,
	) {
		super(disk, path);
	}
}

export class DirectoryDirectoriesListedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:directories-list" as const;
	readonly #startEvent: DirectoryListingDirectoriesEvent;

	constructor(
		startEvent: DirectoryListingDirectoriesEvent,
		public readonly directories: StorageDirectory[],
	) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get recursive(): boolean {
		return this.#startEvent.recursive;
	}
}

// ============================================================================
// Directory Write Operations
// ============================================================================

export class DirectoryDeletingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:delete" as const;
}

export class DirectoryDeletedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:delete" as const;
}
