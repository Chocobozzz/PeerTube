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
    - [Update video constants](#update-video-constants)
    - [Add custom routes](#add-custom-routes)
    - [Add external auth methods](#add-external-auth-methods)
  - [Client helpers (themes & plugins)](#client-helpers-themes--plugins)
    - [Plugin static route](#plugin-static-route)
    - [Notifier](#notifier)
    - [Markdown Renderer](#markdown-renderer)
    - [Custom Modal](#custom-modal)
    - [Translate](#translate)
    - [Get public settings](#get-public-settings)
  - [Publishing](#publishing)
- [Write a plugin/theme](#write-a-plugintheme)
  - [Clone the quickstart repository](#clone-the-quickstart-repository)
  - [Configure your repository](#configure-your-repository)
  - [Update README](#update-readme)
  - [Update package.json](#update-packagejson)
  - [Write code](#write-code)
  - [Add translations](#add-translations)
  - [Test your plugin/theme](#test-your-plugintheme)
  - [Publish](#publish)
- [Plugin & Theme hooks/helpers API](#plugin--theme-hookshelpers-api)
- [Tips](#tips)
  - [Compatibility with PeerTube](#compatibility-with-peertube)
  - [Spam/moderation plugin](#spammoderation-plugin)
  - [Other plugin examples](#other-plugin-examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Concepts

Themes are exactly the same as plugins, except that:
 * Their name starts with `peertube-theme-` instead of `peertube-plugin-`
 * They cannot declare server code (so they cannot register server hooks or settings)
 * CSS files are loaded by client only if the theme is chosen by the administrator or the user

### Hooks

A plugin registers functions in JavaScript to execute when PeerTube (server and client) fires events. There are 3 types of hooks:
 * `filter`: used to filter functions parameters or return values.
 For example to replace words in video comments, or change the videos list behaviour
 * `action`: used to do something after a certain trigger. For example to send a hook every time a video is published
 * `static`: same than `action` but PeerTube waits their execution

On server side, these hooks are registered by the `library` file defined in `package.json`.

```json
{
  ...,
  "library": "./main.js",
  ...,
}
```

And `main.js` defines a `register` function:

Example:

```js
async function register ({
  registerHook,

  registerSetting,
  settingsManager,

  storageManager,

  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,

  peertubeHelpers,

  getRouter,

  registerExternalAuth,
  unregisterExternalAuth,
  registerIdAndPassAuth,
  unregisterIdAndPassAuth
}) {
  registerHook({
    target: 'action:application.listening',
    handler: () => displayHelloWorld()
  })
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

And these scripts also define a `register` function:

```js
function register ({ registerHook, peertubeHelpers }) {
  registerHook({
    target: 'action:application.init',
    handler: () => onApplicationInit(peertubeHelpers)
  })
}
```

### Static files

Plugins can declare static directories that PeerTube will serve (images for example)
from `/plugins/{plugin-name}/{plugin-version}/static/`
or `/themes/{theme-name}/{theme-version}/static/` routes.

### CSS

Plugins can declare CSS files that PeerTube will automatically inject in the client.
If you need to override existing style, you can use the `#custom-css` selector:

```
body#custom-css {
  color: red;
}

#custom-css .header {
  background-color: red;
}
```

### Server helpers (only for plugins)

#### Settings

Plugins can register settings, that PeerTube will inject in the administration interface.

Example:

```js
registerSetting({
  name: 'admin-name',
  label: 'Admin name',
  type: 'input',
  // type: input | input-checkbox | input-textarea | markdown-text | markdown-enhanced
  default: 'my super name'
})

const adminName = await settingsManager.getSetting('admin-name')

const result = await settingsManager.getSettings([ 'admin-name', 'admin-password' ])
result['admin-name]

settingsManager.onSettingsChange(settings => {
  settings['admin-name])
})
```

#### Storage

Plugins can store/load JSON data, that PeerTube will store in its database (so don't put files in there).

Example:

```js
const value = await storageManager.getData('mykey')
await storageManager.storeData('mykey', { subkey: 'value' })
```

#### Update video constants

You can add/delete video categories, licences or languages using the appropriate managers:

```js
videoLanguageManager.addLanguage('al_bhed', 'Al Bhed')
videoLanguageManager.deleteLanguage('fr')

videoCategoryManager.addCategory(42, 'Best category')
videoCategoryManager.deleteCategory(1) // Music

videoLicenceManager.addLicence(42, 'Best licence')
videoLicenceManager.deleteLicence(7) // Public domain

videoPrivacyManager.deletePrivacy(2) // Remove Unlisted video privacy
playlistPrivacyManager.deletePlaylistPrivacy(3) // Remove Private video playlist privacy
```

#### Add custom routes

You can create custom routes using an [express Router](https://expressjs.com/en/4x/api.html#router) for your plugin:

```js
const router = getRouter()
router.get('/ping', (req, res) => res.json({ message: 'pong' }))
```

The `ping` route can be accessed using:
 * `/plugins/:pluginName/:pluginVersion/router/ping`
 * Or `/plugins/:pluginName/router/ping`


#### Add external auth methods

If you want to add a classic username/email and password auth method (like [LDAP](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-ldap) for example):

```js
registerIdAndPassAuth({
  authName: 'my-auth-method',

  // PeerTube will try all id and pass plugins in the weight DESC order
  // Exposing this value in the plugin settings could be interesting
  getWeight: () => 60,

  // Optional function called by PeerTube when the user clicked on the logout button
  onLogout: user => {
    console.log('User %s logged out.', user.username')
  },

  // Optional function called by PeerTube when the access token or refresh token are generated/refreshed
  hookTokenValidity: ({ token, type }) => {
    if (type === 'access') return { valid: true }
    if (type === 'refresh') return { valid: false }
  },

  // Used by PeerTube when the user tries to authenticate
  login: ({ id, password }) => {
    if (id === 'user' && password === 'super password') {
      return {
        username: 'user'
        email: 'user@example.com'
        role: 2
        displayName: 'User display name'
      }
    }

    // Auth failed
    return null
  }
})

// Unregister this auth method
unregisterIdAndPassAuth('my-auth-method')
```

You can also add an external auth method (like [OpenID](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-openid-connect), [SAML2](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-saml2) etc):

```js
// result contains the userAuthenticated auth method you can call to authenticate a user
const result = registerExternalAuth({
  authName: 'my-auth-method',

  // Will be displayed in a button next to the login form
  authDisplayName: () => 'Auth method'

  // If the user click on the auth button, PeerTube will forward the request in this function
  onAuthRequest: (req, res) => {
    res.redirect('https://external-auth.example.com/auth')
  },

  // Same than registerIdAndPassAuth option
  // onLogout: ...

  // Same than registerIdAndPassAuth option
  // hookTokenValidity: ...
})

router.use('/external-auth-callback', (req, res) => {
  // Forward the request to PeerTube
  result.userAuthenticated({
    req,
    res,
    username: 'user'
    email: 'user@example.com'
    role: 2
    displayName: 'User display name'
  })
})

// Unregister this external auth method
unregisterExternalAuth('my-auth-method)
```

### Client helpers (themes & plugins)

#### Plugin static route

To get your plugin static route:

```js
const baseStaticUrl = peertubeHelpers.getBaseStaticRoute()
const imageUrl = baseStaticUrl + '/images/chocobo.png'
```

#### Notifier

To notify the user with the PeerTube ToastModule:

```js
const { notifier } = peertubeHelpers
notifier.success('Success message content.')
notifier.error('Error message content.')
```

#### Markdown Renderer

To render a formatted markdown text to HTML:

```js
const { markdownRenderer } = peertubeHelpers

await markdownRenderer.textMarkdownToHTML('**My Bold Text**')
// return <strong>My Bold Text</strong>

await markdownRenderer.enhancedMarkdownToHTML('![alt-img](http://.../my-image.jpg)')
// return <img alt=alt-img src=http://.../my-image.jpg />
```

#### Custom Modal

To show a custom modal:

```js
 peertubeHelpers.showModal({
   title: 'My custom modal title',
   content: '<p>My custom modal content</p>',
   // Optionals parameters :
   // show close icon
   close: true,
   // show cancel button and call action() after hiding modal
   cancel: { value: 'cancel', action: () => {} },
   // show confirm button and call action() after hiding modal
   confirm: { value: 'confirm', action: () => {} },
 })
```

#### Translate

You can translate some strings of your plugin (PeerTube will use your `translations` object of your `package.json` file):

```js
peertubeHelpers.translate('User name')
   .then(translation => console.log('Translated User name by ' + translation))
```

#### Get public settings

To get your public plugin settings:

```js
peertubeHelpers.getSettings()
  .then(s => {
    if (!s || !s['site-id'] || !s['url']) {
      console.error('Matomo settings are not set.')
      return
    }

    // ...
  })
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

### Add translations

If you want to translate strings of your plugin (like labels of your registered settings), create a file and add it to `package.json`:

```json
{
  ...,
  "translations": {
    "fr-FR": "./languages/fr.json",
    "pt-BR": "./languages/pt-BR.json"
  },
  ...
}
```

The key should be one of the locales defined in [i18n.ts](https://github.com/Chocobozzz/PeerTube/blob/develop/shared/models/i18n/i18n.ts).
You **must** use the complete locales (`fr-FR` instead of `fr`).

Translation files are just objects, with the english sentence as the key and the translation as the value.
`fr.json` could contain for example:

```json
{
  "Hello world": "Hello le monde"
}
```

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


## Plugin & Theme hooks/helpers API

See the dedicated documentation: https://docs.joinpeertube.org/#/api-plugins


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
  * Don't try to require parent PeerTube modules, only use `peertubeHelpers`. If you need another helper or a specific hook, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues/new)
  * Don't use PeerTube dependencies. Use your own :)

If your plugin is broken with a new PeerTube release, update your code and the `peertubeEngine` field of your `package.json` field.
This way, older PeerTube versions will still use your old plugin, and new PeerTube versions will use your updated plugin.

### Spam/moderation plugin

If you want to create an antispam/moderation plugin, you could use the following hooks:
 * `filter:api.video.upload.accept.result`: to accept or not local uploads
 * `filter:api.video-thread.create.accept.result`: to accept or not local thread
 * `filter:api.video-comment-reply.create.accept.result`: to accept or not local replies
 * `filter:api.video-threads.list.result`: to change/hide the text of threads
 * `filter:api.video-thread-comments.list.result`: to change/hide the text of replies
 * `filter:video.auto-blacklist.result`: to automatically blacklist local or remote videos

### Other plugin examples

You can take a look to "official" PeerTube plugins if you want to take inspiration from them: https://framagit.org/framasoft/peertube/official-plugins
