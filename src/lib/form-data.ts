import {
  isMultipartRequest,
  parseMultipartRequest,
  type MultipartPart
} from "@mjackson/multipart-parser";

/**
 * Returns true if the request is URL encoded.
 */
export function isUrlEncodedRequest(request: Request): boolean {
  let contentType = request.headers.get("Content-Type");
  return (
    contentType != null &&
    contentType.startsWith("application/x-www-form-urlencoded")
  );
}

/**
 * A function used for handling file uploads.
 */
export interface FileUploadHandler {
  (part: MultipartPart): Promise<File>;
}

async function defaultFileUploadHandler(part: MultipartPart): Promise<File> {
  return new File([await part.arrayBuffer()], part.filename ?? "", {
    type: part.mediaType
  });
}

/**
 * Parses a `Request` body into a `FormData` object. This is useful for accessing the data contained
 * in a HTTP `POST` request generated by a HTML `<form>` element.
 *
 * The major difference between this function and using the built-in `request.formData()` API is the
 * ability to customize the handling of file uploads. Instead of buffering the entire file in memory,
 * the `handleFileUpload` function allows you to store the file on disk or in a cloud storage service.
 */
export async function parseFormData(
  request: Request,
  handleFileUpload: FileUploadHandler = defaultFileUploadHandler
): Promise<FormData> {
  if (isUrlEncodedRequest(request)) {
    let formData = new FormData();
    let params = new URLSearchParams(await request.text());

    for (let [key, value] of params) {
      formData.append(key, value);
    }

    return formData;
  }

  if (isMultipartRequest(request)) {
    let formData = new FormData();

    for await (let part of parseMultipartRequest(request)) {
      if (!part.name) continue;

      if (part.isFile) {
        formData.append(part.name, await handleFileUpload(part));
      } else {
        formData.append(part.name, await part.text());
      }
    }

    return formData;
  }

  throw new Error(
    `Cannot parse form data from request Content-Type "${request.headers.get(
      "Content-Type"
    )}"`
  );
}
