import { createFetchServer } from '@mjackson/node-fetch-server';

const PORT = process.env.PORT || 3000;

let server = createFetchServer(() => {
  let stream = new ReadableStream({
    start(controller) {
      controller.enqueue('<html><body><h1>Hello, world!</h1></body></html>');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/html' },
  });
});

server.listen(PORT);
