import { MultipartParser, defaultOptions } from 'formidable';
import { Stream } from 'node:stream';
import { MultipartMessage } from '../messages.ts';

export async function parse(input: MultipartMessage): Promise<number> {
  let start = performance.now();

  const parser = formidableMultipart(input.boundary, {
    onPart(part: any) {
      // console.log(part);
    },
  });

  for await (const chunk of input.generateChunks()) {
    parser.write(chunk);
  }

  parser.end();

  return performance.now() - start;
}

function formidableMultipart(boundary: string, options = defaultOptions) {
  const parser = new MultipartParser(options);
  let headerField = '';
  let headerValue = '';
  let part: any;

  parser.initWithBoundary(boundary);

  // eslint-disable-next-line max-statements, consistent-return
  parser.on('data', async ({ name, buffer, start, end }: any) => {
    if (name === 'partBegin') {
      part = new Stream();
      part.readable = true;
      part.headers = {};
      part.name = null;
      part.originalFilename = crypto.randomUUID();
      part.mimetype = null;

      part.transferEncoding = options.encoding;
      part.transferBuffer = '';

      headerField = '';
      headerValue = '';
    } else if (name === 'headerField') {
      headerField += buffer.toString(options.encoding, start, end);
    } else if (name === 'headerValue') {
      headerValue += buffer.toString(options.encoding, start, end);
    } else if (name === 'headerEnd') {
      headerField = headerField.toLowerCase();
      part.headers[headerField] = headerValue;

      // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
      const m = headerValue.match(
        // eslint-disable-next-line no-useless-escape
        /\bname=("([^"]*)"|([^\(\)<>@,;:\\"\/\[\]\?=\{\}\s\t/]+))/i,
      );
      if (headerField === 'content-disposition') {
        if (m) {
          part.name = m[2] || m[3] || '';
        }

        // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
        const m2 = headerValue.match(
          // eslint-disable-next-line no-useless-escape
          /\bfilename=("([^"]*)"|([^\(\)<>@,;:\\"\/\[\]\?=\{\}\s\t/]+))/i,
        );
        if (m2) {
          part.originalFilename = m2[2] || m2[3] || crypto.randomUUID();
        }
      } else if (headerField === 'content-type') {
        part.mimetype = headerValue;
      } else if (headerField === 'content-transfer-encoding') {
        part.transferEncoding = headerValue.toLowerCase();
      }

      headerField = '';
      headerValue = '';
    } else if (name === 'headersEnd') {
      switch (part.transferEncoding) {
        case 'binary':
        case '7bit':
        case '8bit':
        case 'utf-8': {
          const dataPropagation = (ctx: any) => {
            if (ctx.name === 'partData') {
              part.emit('data', ctx.buffer.slice(ctx.start, ctx.end));
            }
          };
          const dataStopPropagation = (ctx: any) => {
            if (ctx.name === 'partEnd') {
              part.emit('end');
              parser.off('data', dataPropagation);
              parser.off('data', dataStopPropagation);
            }
          };
          parser.on('data', dataPropagation);
          parser.on('data', dataStopPropagation);
          break;
        }
        case 'base64': {
          const dataPropagation = (ctx: any) => {
            if (ctx.name === 'partData') {
              part.transferBuffer += ctx.buffer.slice(ctx.start, ctx.end).toString('ascii');

              /*
                  four bytes (chars) in base64 converts to three bytes in binary
                  encoding. So we should always work with a number of bytes that
                  can be divided by 4, it will result in a number of bytes that
                  can be divided by 3.
                  */
              const buflen = part.transferBuffer.length;

              const offset = Number.parseInt(String(buflen / 4), 10) * 4;
              part.emit('data', Buffer.from(part.transferBuffer.substring(0, offset), 'base64'));
              part.transferBuffer = part.transferBuffer.substring(offset);
            }
          };
          const dataStopPropagation = (ctx: any) => {
            if (ctx.name === 'partEnd') {
              part.emit('data', Buffer.from(part.transferBuffer, 'base64'));
              part.emit('end');
              parser.off('data', dataPropagation);
              parser.off('data', dataStopPropagation);
            }
          };
          parser.on('data', dataPropagation);
          parser.on('data', dataStopPropagation);
          break;
        }
        // default:
        //   console.error('unknown transfer-encoding');
      }
      parser.pause();
      await options?.onPart(part);
      parser.resume();
    } else if (name === 'end') {
      parser.emit('end');
    }
  });

  return parser;
}
