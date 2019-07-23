# Plugins & Themes

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Concepts](#concepts)
  - [Hooks](#hooks)
  - [Static files](#static-files)
  - [CSS](#css)
  - [Server helpers (only for plugins)](#server-helpers-only-for-plugins)
    - [Settings](#settings)
    - [Storage](#storage)
  - [Publishing](#publishing)
- [Write a plugin/theme](#write-a-plugintheme)
  - [Clone the quickstart repository](#clone-the-quickstart-repository)
  - [Configure your repository](#configure-your-repository)
  - [Update README](#update-readme)
  - [Update package.json](#update-packagejson)
  - [Write code](#write-code)
  - [Test your plugin/theme](#test-your-plugintheme)
  - [Publish](#publish)
- [Tips](#tips)
  - [Compatibility with PeerTube](#compatibility-with-peertube)
  - [Spam/moderation plugin](#spammoderation-plugin)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Concepts

Themes are exactly the same than plugins, except that:
 * Their name starts with `peertube-theme-` instead of `peertube-plugin-`
 * They cannot declare server code (so they cannot register server hooks or settings)
 * CSS files are loaded by client only if the theme is chosen by the administrator or the user

### Hooks

A plugin registers functions in JavaScript to execute when PeerTube (server and client) fires events. There are 3 types of hooks:
 * `filter`: used to filter functions parameters or return values. 
 For example to replace words in video comments, or change the videos list behaviour
 * `action`: used to do something after a certain trigger. For example to send a hook every time a video is published
 * `static`: same than `action` but PeerTube waits their execution
 
Example:

```js
// This register function is called by PeerTube, and **must** return a promise
async function register ({ registerHook, registerSetting, settingsManager, storageManager, peertubeHelpers }) {
  registerHook({
    target: 'action:application.listening',
    handler: () => displayHelloWorld()
  })
}
```

On server side, these hooks are registered by the `library` file defined in `package.json`.

```json
{
  ...,
  "library": "./main.js",
  ...,
}
```


On client side, these hooks are registered by the `clientScripts` files defined in `package.json`.
All client scripts have scopes so PeerTube client only loads scripts it needs:

```json
{
  ...,
  "clientScripts": [
    {
      "script": "client/common-client-plugin.js",
      "scopes": [ "common" ]
    },
    {
      "script": "client/video-watch-client-plugin.js",
      "scopes": [ "video-watch" ]
    }
  ],
  ...
}
```

### Static files

Plugins can declare static directories that PeerTube will serve (images for example) 
from `/plugins/{plugin-name}/{plugin-version}/static/` 
or `/themes/{theme-name}/{theme-version}/static/` routes.

### CSS

Plugins can declare CSS files that PeerTube will automatically inject in the client.

### Server helpers (only for plugins)

#### Settings

Plugins can register settings, that PeerTube will inject in the administration interface.

Example:

```js
registerSetting({
  name: 'admin-name',
  label: 'Admin name',
  type: 'input',
  default: 'my super name'
})

const adminName = await settingsManager.getSetting('admin-name')
```

#### Storage

Plugins can store/load JSON data, that PeerTube will store in its database (so don't put files in there).

Example:

```js
const value = await storageManager.getData('mykey')
await storageManager.storeData('mykey', { subkey: 'value' })
```

### Publishing

PeerTube plugins and themes should be published on [NPM](https://www.npmjs.com/) so that PeerTube indexes
take into account your plugin (after ~ 1 day). An official PeerTube index is available on https://packages.joinpeertube.org/ (it's just a REST API, so don't expect a beautiful website).

## Write a plugin/theme

Steps:
 * Find a name for your plugin or your theme (must not have spaces, it can only contain lowercase letters and `-`)
 * Add the appropriate prefix:
   * If you develop a plugin, add `peertube-plugin-` prefix to your plugin name (for example: `peertube-plugin-mysupername`)
   * If you develop a theme, add `peertube-theme-` prefix to your theme name (for example: `peertube-theme-mysupertheme`)
 * Clone the quickstart repository
 * Configure your repository
 * Update `README.md`
 * Update `package.json`
 * Register hooks, add CSS and static files
 * Test your plugin/theme with a local PeerTube installation
 * Publish your plugin/theme on NPM

### Clone the quickstart repository

If you develop a plugin, clone the `peertube-plugin-quickstart` repository:

```
$ git clone https://framagit.org/framasoft/peertube/peertube-plugin-quickstart.git peertube-plugin-mysupername
```

If you develop a theme, clone the `peertube-theme-quickstart` repository:

```
$ git clone https://framagit.org/framasoft/peertube/peertube-theme-quickstart.git peertube-theme-mysupername
```

### Configure your repository

Set your repository URL:

```
$ cd peertube-plugin-mysupername # or cd peertube-theme-mysupername
$ git remote set-url origin https://your-git-repo
```

### Update README

Update `README.md` file:

```
$ $EDITOR README.md
```

### Update package.json

Update the `package.json` fields:
   * `name` (should start with `peertube-plugin-` or `peertube-theme-`)
   * `description`
   * `homepage`
   * `author`
   * `bugs`
   * `engine.peertube` (the PeerTube version compatibility, must be `>=x.y.z` and nothing else)
   
**Caution:** Don't update or remove other keys, or PeerTube will not be able to index/install your plugin.
If you don't need static directories, use an empty `object`: 

```json
{
  ...,
  "staticDirs": {},
  ...
}
```

And if you don't need CSS or client script files, use an empty `array`:

```json
{
  ...,
  "css": [],
  "clientScripts": [],
  ...
}
```

### Write code

Now you can register hooks or settings, write CSS and add static directories to your plugin or your theme :)

**Caution:** It's up to you to check the code you write will be compatible with the PeerTube NodeJS version, 
and will be supported by web browsers.
If you want to write modern JavaScript, please use a transpiler like [Babel](https://babeljs.io/).

### Test your plugin/theme

You'll need to have a local PeerTube instance:
 * Follow the [dev prerequisites](https://github.com/Chocobozzz/PeerTube/blob/develop/.github/CONTRIBUTING.md#prerequisites) 
 (to clone the repository, install dependencies and prepare the database)
 * Build PeerTube (`--light` to only build the english language): 

```
$ npm run build -- --light
```

 * Build the CLI:
 
```
$ npm run setup:cli
```
 
 * Run PeerTube (you can access to your instance on http://localhost:9000): 

```
$ NODE_ENV=test npm start
```

 * Register the instance via the CLI: 

```
$ node ./dist/server/tools/peertube.js auth add -u 'http://localhost:9000' -U 'root' --password 'test'
```

Then, you can install or reinstall your local plugin/theme by running:

```
$ node ./dist/server/tools/peertube.js plugins install --path /your/absolute/plugin-or-theme/path
```

### Publish

Go in your plugin/theme directory, and run:

```
$ npm publish
```

Every time you want to publish another version of your plugin/theme, just update the `version` key from the `package.json`
and republish it on NPM. Remember that the PeerTube index will take into account your new plugin/theme version after ~24 hours.


## Tips

### Compatibility with PeerTube

Unfortunately, we don't have enough resources to provide hook compatibility between minor releases of PeerTube (for example between `1.2.x` and `1.3.x`).
So please:
  * Don't make assumptions and check every parameter you want to use. For example:

```js
registerHook({
  target: 'filter:api.video.get.result',
  handler: video => {
    // We check the parameter exists and the name field exists too, to avoid exceptions
    if (video && video.name) video.name += ' <3'

    return video
  }
})
```
  * Don't try to require parent PeerTube modules, only use `peertubeHelpers`. If you need another helper or a specific, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues/new)
  * Don't use PeerTube dependencies. Use your own :) 

If your plugin is broken with a new PeerTube release, update your code and the `peertubeEngine` `package.json` field.
This way, older PeerTube versions will still use your old plugin, and new PeerTube versions will use your updated plugin. 

### Spam/moderation plugin

If you want to create an antispam/moderation plugin, you could use the following hooks:
 * `filter:api.video.upload.accept.result`: to accept or not local uploads
 * `filter:api.video-thread.create.accept.result`: to accept or not local thread
 * `filter:api.video-comment-reply.create.accept.result`: to accept or not local replies
 * `filter:api.video-threads.list.result`: to change/hide the text of threads
 * `filter:api.video-thread-comments.list.result`: to change/hide the text of replies
 * `filter:video.auto-blacklist.result`: to automatically blacklist local or remote videos
 


