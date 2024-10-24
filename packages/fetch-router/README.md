# fetch-router

```ts
// Type-safety features:

// 1. Route handlers

function routeHandler({ params, render }: RouteArg<Params<'id'>, SearchParams, React.ReactNode>) {
  params.get('id') // string
  return render(<div />);
}

let routes = createRoutes(({ route, use }) => [
  use(ReactRenderer, [
    route(':id', routeHandler)
  ])
])

// 2. Links

let href = createHrefBuilder<typeof routes>()
href(':id', { id: '123' }) // '/123'

// 3. Route splitting

let otherRoutes = (router: Router<Params<'id'>, SearchParams>) => [ ... ]

let routes = createRoutes(({ mount }) => [
  mount('/', otherRoutes)
])

// 4. Renderer types

let routes = createRoutes(({ render, route }) => [
  use(StringRenderer, [
    route('/', ({ params, searchParams, context, render }) => {
      return render('hello world', { status: 404 });
    }),
    use(ReactRenderer, [
      route('/react', ({ render }) => {
        return render(<div />);
      })
    ])
  ])
])

// 5. Middleware

function auth(): Middleware<Params<'id'>> {
  return ({ params }) => {
    params.get('id'); // string
  }
}

let routes = createRoutes(() => {
  use: [
    static,
    compression,
  ],
  children: [
    {
      use: [auth],
      children: [
        route(":id", () => {})
      ]
    }
  ]
})

let staticServer = staticMiddleware({
  rootDir: './public',
  fileStorage: new DirectoryFileStorage('./public'), // /assets/foo.js => storage.get('assets/foo.js');
  fileStorage: new CFWorkersKVFileStorage() // /assets/foo.js => storage.get('assets/foo.js');
})

let routes = createRoutes(({ route, use }) => [
  use(logger),
  use(compression),

  use(auth, [
    route('/admin', () => {
      // ...
    })
  ]),
  route(':id', { params } => {
    params.get('id') // string
  })

  route('*', defaultHandler)
])
```
