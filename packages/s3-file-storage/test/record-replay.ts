import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type FetchProxy, createFetchProxy } from '@mjackson/fetch-proxy';

interface RecordingEntry {
  request: {
    url: string;
    method: string;
    headers: Array<[string, string]>;
    body?: string;
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<[string, string]>;
    body: string | null;
  };
}

interface RecordOptions {
  /**
   * The file path where the recorded interactions will be saved
   */
  recordingFilePath: string;
}

interface PlaybackOptions {
  /**
   * The file path of the recording file to use for playback
   */
  recordingFilePath: string;
  /**
   * How to handle requests that don't match any recorded entry
   * - 'error': Throw an error (default)
   * - 'passthrough': Forward the request to the real target
   */
  unmatchedRequestMode?: 'error' | 'passthrough';
  /**
   * The target URL to forward requests to if unmatchedRequestMode is 'passthrough'
   */
  target?: string | URL;
  /**
   * Function to determine if a request matches a recorded request
   * @default Matches on method, url pathname and query parameters
   */
  requestMatcher?: (params: {
    request: Request, 
    recordedRequest: Request, 
    index: number, 
    previouslyUsedIndices: Set<number>,
    mostRecentIndex: number
  }) => boolean;
}

// Store the original fetch function
const originalFetch = globalThis.fetch;
let isGlobalFetchOverridden = false;

/**
 * Creates a recording fetch proxy that captures all requests and responses to a JSON file
 * @param target The URL of the server to proxy requests to
 * @param options Recording options including the recordingFilePath
 */
export async function record(
  target: string | URL,
  options: RecordOptions
): Promise<void> {
  const { recordingFilePath } = options;
  
  // Initialize recorded interactions array
  let recordings: RecordingEntry[] = [];

  // Ensure the directory for the recording file exists
  await ensureDirectoryExists(recordingFilePath);

  // Override global fetch with a fetch-proxy
  globalThis.fetch = createFetchProxy(target, {
    rewriteCookieDomain: false,
    rewriteCookiePath: false,
    xForwardedHeaders: false,
    fetch: async (input, init) => {
      // Capture the request details before sending
      const request = new Request(input, init);
      
      // Forward the request to the original fetch
      const response = await originalFetch(request.clone());
      
      // Clone the response to read its body if available
      const responseClone = response.clone();
      
      // Get request headers
      const requestHeaders: Array<[string, string]> = [];
      request.headers.forEach((value, name) => {
        requestHeaders.push([name, value]);
      });
      
      // Get request body if available
      let requestBodyText: string | undefined;
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
        try {
          requestBodyText = await request.text();
        } catch (error) {
          console.warn('Could not read request body', error);
        }
      }
      
      // Get response headers
      const responseHeaders: Array<[string, string]> = [];
      response.headers.forEach((value, name) => {
        responseHeaders.push([name, value]);
      });
      
      // Get response body if available, otherwise set to null
      let responseBody: string | null = null;
      
      // Check if the response has a body before trying to read it
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      const hasBody = 
        contentType !== null || 
        (contentLength !== null && contentLength !== '0') || 
        response.status === 200 || 
        (response.status >= 200 && response.status < 300 && !['HEAD', 'OPTIONS'].includes(request.method));
      
      if (hasBody) {
        try {
          responseBody = await responseClone.text();
          // If the body is an empty string and the response status indicates no content,
          // set body to null to ensure correct representation
          if (responseBody === '' && [204, 205, 304].includes(response.status)) {
            responseBody = null;
          }
        } catch (error) {
          console.warn('Could not read response body', error);
          responseBody = null;
        }
      }
      
      // Add to recordings
      recordings.push({
        request: {
          url: request.url,
          method: request.method,
          headers: requestHeaders,
          body: requestBodyText
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody
        }
      });
      
      // Create recording data structure with createdAt and entries
      const recordingData = {
        createdAt: new Date().toISOString(),
        entries: recordings
      };
      
      // Write recordings to file
      await writeFile(recordingFilePath, JSON.stringify(recordingData, null, 2), 'utf-8');
      
      // Return the original response
      return response;
    }
  });
  
  isGlobalFetchOverridden = true;
}

/**
 * Default request matcher that matches on method, pathname, and query parameters
 * Ensures recorded requests are used in sequential order
 */
function defaultRequestMatcher(params: {
  request: Request, 
  recordedRequest: Request, 
  index: number, 
  previouslyUsedIndices: Set<number>,
  mostRecentIndex: number
}): boolean {
  const { request, recordedRequest, index, previouslyUsedIndices, mostRecentIndex } = params;

  // Don't match previously used indices
  if (previouslyUsedIndices.has(index)) return false;
  
  // Require sequential access - current index must be mostRecentIndex + 1
  if (index !== mostRecentIndex + 1) {
    throw new Error(`Request sequence error: Expected index ${mostRecentIndex + 1} but got ${index} for ${request.method} ${request.url}`);
  }
  
  // Check if methods match
  if (request.method !== recordedRequest.method) return false;
  
  // Check URL path and query
  const requestUrl = new URL(request.url);
  const recordedUrl = new URL(recordedRequest.url);
  
  // Check pathname
  if (requestUrl.pathname !== recordedUrl.pathname) return false;
  
  // Check search params - all request params must exist in entry with same values
  const requestParams = requestUrl.searchParams;
  const recordedParams = recordedUrl.searchParams;
  
  let paramsMatch = true;
  requestParams.forEach((value, key) => {
    if (recordedParams.get(key) !== value) {
      paramsMatch = false;
    }
  });
  
  return paramsMatch;
}

/**
 * Creates a playback fetch proxy that responds with recorded responses
 * @param options Playback options including the recordingFilePath
 */
export async function playback(options: PlaybackOptions): Promise<void> {
  const { 
    recordingFilePath, 
    unmatchedRequestMode = 'error',
    target,
    requestMatcher = defaultRequestMatcher
  } = options;
  
  // Ensure the directory for the recording file exists
  await ensureDirectoryExists(recordingFilePath);
  
  // Load the recordings file
  let recordings: Array<RecordingEntry>;
  try {
    const data = await readFile(recordingFilePath, 'utf-8');
    const recordingData = JSON.parse(data);
    
    if (!Array.isArray(recordingData.entries)) {
      throw new Error('Recordings file does not contain a valid entries array');
    }
    
    recordings = recordingData.entries;
  } catch (error) {
    throw new Error(`Failed to load recordings file: ${error}`);
  }
  
  // Create a passthrough proxy if needed
  let passthroughProxy: FetchProxy | undefined;
  if (unmatchedRequestMode === 'passthrough' && target) {
    passthroughProxy = createFetchProxy(target);
  }
  
  // Keep track of which indices have been previously used and the most recent index
  const previouslyUsedIndices = new Set<number>();
  let mostRecentIndex = -1;
  
  // Override the global fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    
    // Try to find a matching recording
    let matchingIndex = -1;
    const matchingRecording = recordings.find((recording, index) => {
      const matches = requestMatcher({
        request, 
        recordedRequest: new Request(recording.request.url, {
          method: recording.request.method,
          headers: new Headers(recording.request.headers),
          body: recording.request.body
        }),
        index,
        previouslyUsedIndices,
        mostRecentIndex
      });
      
      if (matches) {
        matchingIndex = index;
        previouslyUsedIndices.add(index);
        mostRecentIndex = index;
        return true;
      }
      return false;
    });
    
    if (matchingRecording) {
      // Return a new Response object with the recorded response data
      return new Response(
        matchingRecording.response.body,
        {
          status: matchingRecording.response.status,
          statusText: matchingRecording.response.statusText,
          headers: new Headers(matchingRecording.response.headers)
        }
      );
    }
    
    // No matching recording found
    if (unmatchedRequestMode === 'passthrough' && passthroughProxy) {
      console.warn(`No matching recording found for ${request.method} ${request.url}, passing through to target`);
      return passthroughProxy(request);
    } else {
      throw new Error(`No matching recording found for ${request.method} ${request.url}. Expected index ${mostRecentIndex + 1}.`);
    }
  };
  
  isGlobalFetchOverridden = true;
}

/**
 * Overrides the global fetch with a recording or playback proxy
 * @param target The URL of the server to proxy requests to
 * @param options Configuration options for record or playback mode
 * @throws Error if global fetch is already overridden
 */
export async function overrideGlobalFetch(
  target: string | URL,
  options: {
    mode: 'record' | 'playback';
    recordingFilePath: string;
    playbackOptions?: Omit<PlaybackOptions, 'recordingFilePath'>;
  }
): Promise<void> {
  if (isGlobalFetchOverridden) {
    throw new Error('Global fetch is already overridden. Call resetGlobalFetch() first.');
  }

  if (options.mode === 'record') {
    await record(target, { 
      recordingFilePath: options.recordingFilePath 
    });
  } else {
    await playback({
      recordingFilePath: options.recordingFilePath,
      ...options.playbackOptions,
      target
    });
  }
}

/**
 * Resets the global fetch to its original implementation
 */
export function resetGlobalFetch(): void {
  if (isGlobalFetchOverridden) {
    globalThis.fetch = originalFetch;
    isGlobalFetchOverridden = false;
  }
}

/**
 * Ensures that the directory for a file exists
 * @param filePath The file path to ensure the directory for
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const directory = dirname(filePath);
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}
