import * as http from 'node:http';

import type { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.js';

import { FetchIncomingMessage as IncomingMessage } from './fetch-incoming-message/index.js';
import { internalServerError } from './utils.js';
import { sendResponse } from './request-listener.js';

export interface RequestListenerOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from the HTTP `Host` header.
   *
   * For example, if you have a `$HOST` environment variable that contains the hostname of your
   * server, you can use it to set the host of all incoming request URLs like so:
   *
   * ```ts
   * createRequestListener(handler, { host: process.env.HOST })
   * ```
   */
  host?: string;
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler;
  /**
   * Overrides the protocol of the incoming request URL. By default the request URL protocol is
   * derived from the connection protocol. So e.g. when serving over HTTPS (using
   * `https.createServer()`), the request URL will begin with `https:`.
   */
  protocol?: string;
}

export function createFetchServer(handler: FetchHandler, options?: RequestListenerOptions) {
  let onError = options?.onError ?? defaultErrorHandler;

  // @ts-expect-error
  return http.createServer<IncomingMessage>(
    { IncomingMessage },
    async (req: IncomingMessage, res) => {
      let controller = new AbortController();
      res.on('close', () => {
        controller.abort();
      });

      let client = {
        address: req.socket.remoteAddress!,
        family: req.socket.remoteFamily! as ClientAddress['family'],
        port: req.socket.remotePort!,
      };

      let response: Response;
      try {
        // @ts-expect-error
        response = await handler(req, client);
      } catch (error) {
        try {
          response = (await onError(error)) ?? internalServerError();
        } catch (error) {
          console.error(`There was an error in the error handler: ${error}`);
          response = internalServerError();
        }
      }

      await sendResponse(res, response);
    },
  );
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error);
  return internalServerError();
}
