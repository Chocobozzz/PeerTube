# Client code documentation

The client is a HTML/CSS/JavaScript web application (single page application -> SPA) developed with [TypeScript](https://www.typescriptlang.org/)/[Angular](https://angular.io/).


## Technologies

  * [TypeScript](https://www.typescriptlang.org/) -> Language
  * [Angular](https://angular.io) -> JavaScript framework
  * [SASS](http://sass-lang.com/) -> CSS framework
  * [Webpack](https://webpack.js.org/) -> Source builder (compile TypeScript, SASS files, bundle them...)
  * [Bootstrap](http://getbootstrap.com/) -> CSS framework
  * [WebTorrent](https://webtorrent.io/) -> JavaScript library to make P2P in the browser
  * [VideoJS](http://videojs.com/) -> JavaScript player framework


## Files

The client files are in the `client` directory. The Webpack 2 configurations files are in `client/config` and the source files in `client/src`.
The client modules description are in the [client/package.json](/client/package.json). There are many modules that are used to compile the web application in development or production mode.
Here is the description of the useful `client` files directory:

    tslint.json   -> TypeScript linter rules
    tsconfig.json -> TypeScript configuration for the compilation
    .bootstraprc  -> Bootstrap configuration file (which module we need)
    config        -> Webpack configuration files
    src
    |__ app          -> TypeScript files for Angular application
    |__ assets       -> static files (images...)
    |__ sass         -> SASS files that are global for the application
    |__ standalone   -> files outside the Angular application (embed HTML page...)
    |__ index.html   -> root HTML file for our Angular application
    |__ main.ts      -> Main TypeScript file that boostraps our Angular application
    |__ polyfills.ts -> Polyfills imports (ES 2015...)

Details of the Angular application file structure. It tries to follow [the official Angular styleguide](https://angular.io/docs/ts/latest/guide/style-guide.html).

    app
    |__ +admin                       -> Admin components (followers, users...)
    |__ account                      -> Account components (password change...)
    |__ core                         -> Core components/services
    |__ header                       -> Header components (logo, search...)
    |__ login                        -> Login component
    |__ menu                         -> Menu component (on the left)
    |__ shared                       -> Shared components/services (search component, REST services...)
    |__ signup                       -> Signup form
    |__ videos                       -> Video components (list, watch, upload...)
    |__ app.component.{html,scss,ts} -> Main application component
    |__ app-routing.module.ts        -> Main Angular routes
    |__ app.module.ts                -> Angular root module that imports all submodules we need

## Conventions

Uses [TSLint](https://palantir.github.io/tslint/) for TypeScript linting and [Angular styleguide](https://angular.io/docs/ts/latest/guide/style-guide.html).

## Concepts

In a Angular application, we create components that we put together. Each component is defined by an HTML structure, a TypeScript file and optionally a SASS file.
If you are not familiar with Angular I recommend you to read the [quickstart guide](https://angular.io/docs/ts/latest/quickstart.html).

## Components tree

![Components tree](/support/doc/development/client/components-tree.svg)

## Newcomers

The main client component is `app.component.ts`. You can begin to look at this file. Then you could navigate in the different submodules to see how components are built.
