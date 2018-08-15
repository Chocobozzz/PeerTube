# Desktop Version

If build fail with webpack install you must do :

Package.json: remove webpack from DevDependencies
```sh
rm -R node_modules/
npm i -g webpack webpack-dev-server
npm i
npm start
```
