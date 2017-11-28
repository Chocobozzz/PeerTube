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
The client modules description are in the [client/package.json](https://github.com/Chocobozzz/PeerTube/blob/master/client/package.json). There are many modules that are used to compile the web application in development or production mode.
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
    |__ vendor.ts    -> Vendor imports (Angular, Bootstrap...)

Details of the Angular application file structure. It tries to follow [the official Angular styleguide](https://angular.io/docs/ts/latest/guide/style-guide.html).

    app
    |__ account                      -> Account components (password change...)
    |__ admin                        -> Admin components (friends, users...)
    |__ core                         -> Core components/services
    |__ login                        -> Login component
    |__ shared                       -> Shared components/services (search component, REST services...)
    |__ videos                       -> Video components (list, watch, upload...)
    |__ app.component.{html,scss,ts} -> Main application component
    |__ app.module.ts                -> Angular root module that imports all submodules we need

## Conventions

Uses [TSLint](https://palantir.github.io/tslint/) for TypeScript linting and [Angular styleguide](https://angular.io/docs/ts/latest/guide/style-guide.html).

## Developing

  * Install [the dependencies](https://github.com/Chocobozzz/PeerTube#dependencies)
  * Run `yarn install` at the root directory to install all the dependencies
  * Run PostgreSQL and create the database `peertube_dev`.
  * Run `npm run dev:client` to compile the client, run the server, watch client files modifications and reload modules on the fly (you don't need to refresh manually the web browser). The API listen on `localhost:9000` and the client on `localhost:3000`.

In a Angular application, we create components that we put together. Each component is defined by an HTML structure, a TypeScript file and optionnaly a SASS file.
If you are not familiar with Angular I recommend you to read the [quickstart guide](https://angular.io/docs/ts/latest/quickstart.html).

## Components tree

![Components tree](https://github.com/Chocobozzz/PeerTube/blob/master/support/doc/client/components-tree.png)

## Newcomers

The main client component is `app.component.ts`. You can begin to look at this file. Then you could navigate in the different submodules to see how components are built.
