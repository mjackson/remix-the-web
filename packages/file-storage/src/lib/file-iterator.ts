import type {
  FileKey,
  FileMetadata,
  FileStorage,
  ListOptions,
  ListResult,
} from './file-storage.ts';

/**
 * Error thrown when there is a problem during file storage iteration.
 */
export class FileStorageIterationError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FileStorageIterationError';
    this.cause = cause;
  }
}

/**
 * Options for iterating over files in storage.
 */
export interface IterateOptions<T extends ListOptions> extends ListOptions {
    /**
     * The number of items to fetch per page.
     */
    pageSize?: number;
    /**
     * Signal that can be used to abort the iteration.
     */
    signal?: AbortSignal;

    /**
     * The first page of files to yield. Allows starting iteration from a specific point.
     */
    firstPage?: (T extends { includeMetadata: true } ? FileMetadata : FileKey)[]
}

/**
 * Internal helper class that implements the async iteration logic for FileStorage.
 * 
 * This class handles pagination and prefetching of files from storage, providing
 * an efficient way to iterate over large datasets without loading everything into
 * memory at once.
 */
export class FileIterator<T extends ListOptions> implements AsyncIterable<(T extends { includeMetadata: true } ? FileMetadata : FileKey)> {
  private storage: FileStorage;
  private options: IterateOptions<T>;
  private pageSize: number;
  private itemsYielded: number;
  private limit: number | undefined;

  constructor(storage: FileStorage, options?: IterateOptions<T>) {
    this.storage = storage;
    this.options = options ?? {} as T;
    this.limit = options?.limit;
    this.itemsYielded = 0;
    this.pageSize = options?.pageSize ?? 32;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<(T extends { includeMetadata: true } ? FileMetadata : FileKey)> {
    let nextPagePromise: Promise<ListResult<T>> | null = null;

    // Helper function to fetch a page
    const fetchPage = async (remainingItems: number | undefined, cursor?: string): Promise<ListResult<T>> => {
      if(remainingItems === 0) {
        return {
          cursor: undefined,
          files: [],
          [Symbol.asyncIterator]() {
            return {
              next: async () => ({ done: true, value: undefined })
            };
          }
        };
      }

      try {
        // Adjust page size if needed based on remaining items
        const adjustedPageSize = remainingItems && remainingItems < this.pageSize 
          ? remainingItems 
          : this.pageSize;

        // One last check for abort status
        if (this.options.signal?.aborted) {
            return Promise.reject(new FileStorageIterationError('Iteration aborted', 
                this.options.signal.reason
            ));
        }

        const result = await this.storage.list({
          ...this.options,
          cursor,
          limit: adjustedPageSize
        } as T);
        return result;
      } catch (error) {
        throw new FileStorageIterationError('Error fetching page from storage', 
          error
        );
      }
    };

    try {
      // If we have a first page, yield it and set up next page fetch
      if (this.options.firstPage) {
        // Check for abort before yielding first page
        if (this.options.signal?.aborted) {
          throw new FileStorageIterationError('Iteration aborted', 
            this.options.signal.reason
          );
        }
        const firstPage = this.limit && this.limit < this.options.firstPage.length 
            ? this.options.firstPage.slice(0, this.limit)
            : this.options.firstPage;
        yield* firstPage;
        this.itemsYielded += firstPage.length;
        
        nextPagePromise = this.options.cursor ? fetchPage(this.limit ? this.limit - this.itemsYielded : undefined, this.options.cursor) : null;
      } else {
        // Start fetching the first page
        nextPagePromise = fetchPage(this.limit ? this.limit - this.itemsYielded : undefined);
      }

      while (nextPagePromise !== null) {
        if (this.options.signal?.aborted) {
            throw new FileStorageIterationError('Iteration aborted', 
              this.options.signal.reason
            );
        }
        
        const remainingItems = this.limit ? this.limit - this.itemsYielded : undefined;
        // Wait for the current page to load
        const currentPage: ListResult<T> = await nextPagePromise;
        
        // If we have a next page, start fetching it in the background
        nextPagePromise = currentPage.cursor ? fetchPage(remainingItems, currentPage.cursor) : null;

        // If we got no files, we're done
        if (currentPage.files.length === 0) {
          break;
        }

        // Check for abort before yielding
        if (this.options.signal?.aborted) {
          throw new FileStorageIterationError('Iteration aborted', 
            this.options.signal.reason
          );
        }

        // Yield the current page (respecting the limit)
        if (remainingItems && remainingItems < currentPage.files.length) {
            currentPage.files = currentPage.files.slice(0, remainingItems);
        }
        yield* currentPage.files;
        this.itemsYielded += currentPage.files.length;
      }
    } catch (error) {
      if (error instanceof FileStorageIterationError) {
        throw error;
      }
      throw new FileStorageIterationError('Error during iteration', error);
    }
  }
} 
