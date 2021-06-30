# Plugins & Themes

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Concepts](#concepts)
  - [Hooks](#hooks)
  - [Static files](#static-files)
  - [CSS](#css)
  - [Server API (only for plugins)](#server-api-only-for-plugins)
    - [Settings](#settings)
    - [Storage](#storage)
    - [Update video constants](#update-video-constants)
    - [Add custom routes](#add-custom-routes)
    - [Add external auth methods](#add-external-auth-methods)
    - [Add new transcoding profiles](#add-new-transcoding-profiles)
    - [Server helpers](#server-helpers)
  - [Client API (themes & plugins)](#client-api-themes--plugins)
    - [Plugin static route](#plugin-static-route)
    - [Notifier](#notifier)
    - [Markdown Renderer](#markdown-renderer)
    - [Auth header](#auth-header)
    - [Plugin router route](#plugin-router-route)
    - [Custom Modal](#custom-modal)
    - [Translate](#translate)
    - [Get public settings](#get-public-settings)
    - [Get server config](#get-server-config)
    - [Add custom fields to video form](#add-custom-fields-to-video-form)
    - [Register settings script](#register-settings-script)
    - [HTML placeholder elements](#html-placeholder-elements)
    - [Add/remove left menu links](#addremove-left-menu-links)
  - [Publishing](#publishing)
- [Write a plugin/theme](#write-a-plugintheme)
  - [Clone the quickstart repository](#clone-the-quickstart-repository)
  - [Configure your repository](#configure-your-repository)
  - [Update README](#update-readme)
  - [Update package.json](#update-packagejson)
  - [Write code](#write-code)
  - [Add translations](#add-translations)
  - [Build your plugin](#build-your-plugin)
  - [Test your plugin/theme](#test-your-plugintheme)
  - [Publish](#publish)
  - [Unpublish](#unpublish)
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

### Server API (only for plugins)

#### Settings

Plugins can register settings, that PeerTube will inject in the administration interface.
The following fields will be automatically translated using the plugin translation files: `label`, `html`, `descriptionHTML`, `options.label`.
**These fields are injected in the plugin settings page as HTML, so pay attention to your translation files.**

Example:

```js
function register (...) {
  registerSetting({
    name: 'admin-name',
    label: 'Admin name',

    type: 'input',
    // type: 'input' | 'input-checkbox' | 'input-password' | 'input-textarea' | 'markdown-text' | 'markdown-enhanced' | 'select' | 'html'

    // Optional
    descriptionHTML: 'The purpose of this field is...',

    default: 'my super name',

    // If the setting is not private, anyone can view its value (client code included)
    // If the setting is private, only server-side hooks can access it
    private: false
  })

  const adminName = await settingsManager.getSetting('admin-name')

  const result = await settingsManager.getSettings([ 'admin-name', 'admin-password' ])
  result['admin-name]

  settingsManager.onSettingsChange(settings => {
    settings['admin-name])
  })
}
```

#### Storage

Plugins can store/load JSON data, that PeerTube will store in its database (so don't put files in there).

Example:

```js
function register ({
  storageManager
}) {
  const value = await storageManager.getData('mykey')
  await storageManager.storeData('mykey', { subkey: 'value' })
}
```

You can also store files in the plugin data directory (`/{plugins-directory}/data/{npm-plugin-name}`) **in PeerTube >= 3.2**.
This directory and its content won't be deleted when your plugin is uninstalled/upgraded.

```js
function register ({
  storageManager,
  peertubeHelpers
}) {
  const basePath = peertubeHelpers.plugin.getDataDirectoryPath()

  fs.writeFile(path.join(basePath, 'filename.txt'), 'content of my file', function (err) {
    ...
  })
}
```

#### Update video constants

You can add/delete video categories, licences or languages using the appropriate managers:

```js
function register (...) {
  videoLanguageManager.addLanguage('al_bhed', 'Al Bhed')
  videoLanguageManager.deleteLanguage('fr')

  videoCategoryManager.addCategory(42, 'Best category')
  videoCategoryManager.deleteCategory(1) // Music

  videoLicenceManager.addLicence(42, 'Best licence')
  videoLicenceManager.deleteLicence(7) // Public domain

  videoPrivacyManager.deletePrivacy(2) // Remove Unlisted video privacy
  playlistPrivacyManager.deletePlaylistPrivacy(3) // Remove Private video playlist privacy
}
```

#### Add custom routes

You can create custom routes using an [express Router](https://expressjs.com/en/4x/api.html#router) for your plugin:

```js
function register ({
  router
}) {
  const router = getRouter()
  router.get('/ping', (req, res) => res.json({ message: 'pong' }))

  // Users are automatically authenticated
  router.get('/auth', async (res, res) => {
    const user = await peertubeHelpers.user.getAuthUser(res)

    const isAdmin = user.role === 0
    const isModerator = user.role === 1
    const isUser = user.role === 2

    res.json({
      username: user.username,
      isAdmin,
      isModerator,
      isUser
    })
  })
}
```

The `ping` route can be accessed using:
 * `/plugins/:pluginName/:pluginVersion/router/ping`
 * Or `/plugins/:pluginName/router/ping`


#### Add external auth methods

If you want to add a classic username/email and password auth method (like [LDAP](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-ldap) for example):

```js
function register (...) {

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
}
```

You can also add an external auth method (like [OpenID](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-openid-connect), [SAML2](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-saml2) etc):

```js
function register (...) {

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
}
```

#### Add new transcoding profiles

Adding transcoding profiles allow admins to change ffmpeg encoding parameters and/or encoders.
A transcoding profile has to be chosen by the admin of the instance using the admin configuration.

```js
async function register ({
  transcodingManager
}) {

  // Adapt bitrate when using libx264 encoder
  {
    const builder = (options) => {
      const { input, resolution, fps, streamNum } = options

      const streamString = streamNum ? ':' + streamNum : ''

      // You can also return a promise
      // All these options are optional
      return {
        scaleFilter: {
          // Used to define an alternative scale filter, needed by some encoders
          // Default to 'scale'
          name: 'scale_vaapi'
        },
        // Default to []
        inputOptions: [],
        // Default to []
        outputOptions: [
        // Use a custom bitrate
          '-b' + streamString + ' 10K'
        ]
      }
    }

    const encoder = 'libx264'
    const profileName = 'low-quality'

    // Support this profile for VOD transcoding
    transcodingManager.addVODProfile(encoder, profileName, builder)

    // And/Or support this profile for live transcoding
    transcodingManager.addLiveProfile(encoder, profileName, builder)
  }

  {
    const builder = (options) => {
      const { streamNum } = options

      const streamString = streamNum ? ':' + streamNum : ''

      // Always copy stream when PeerTube use libfdk_aac or aac encoders
      return {
        copy: true
      }
    }

    const profileName = 'copy-audio'

    for (const encoder of [ 'libfdk_aac', 'aac' ]) {
      transcodingManager.addVODProfile(encoder, profileName, builder)
    }
  }
```

PeerTube will try different encoders depending on their priority.
If the encoder is not available in the current transcoding profile or in ffmpeg, it tries the next one.
Plugins can change the order of these encoders and add their custom encoders:

```js
async function register ({
  transcodingManager
}) {

  // Adapt bitrate when using libx264 encoder
  {
    const builder = () => {
      return {
        inputOptions: [],
        outputOptions: []
      }
    }

    // Support libopus and libvpx-vp9 encoders (these codecs could be incompatible with the player)
    transcodingManager.addVODProfile('libopus', 'test-vod-profile', builder)

    // Default priorities are ~100
    // Lowest priority = 1
    transcodingManager.addVODEncoderPriority('audio', 'libopus', 1000)

    transcodingManager.addVODProfile('libvpx-vp9', 'test-vod-profile', builder)
    transcodingManager.addVODEncoderPriority('video', 'libvpx-vp9', 1000)

    transcodingManager.addLiveProfile('libopus', 'test-live-profile', builder)
    transcodingManager.addLiveEncoderPriority('audio', 'libopus', 1000)
  }
```

During live transcode input options are applied once for each target resolution.
Plugins are responsible for detecting such situation and applying input options only once if necessary.

#### Server helpers

PeerTube provides your plugin some helpers. For example:

```js
async function register ({
  peertubeHelpers
}) {
  // Block a server
  {
    const serverActor = await peertubeHelpers.server.getServerActor()

    await peertubeHelpers.moderation.blockServer({ byAccountId: serverActor.Account.id, hostToBlock: '...' })
  }

  // Load a video
  {
    const video = await peertubeHelpers.videos.loadByUrl('...')
  }
}
```

See the [plugin API reference](https://docs.joinpeertube.org/api-plugins) to see the complete helpers list.

### Client API (themes & plugins)

#### Plugin static route

To get your plugin static route:

```js
function register (...) {
  const baseStaticUrl = peertubeHelpers.getBaseStaticRoute()
  const imageUrl = baseStaticUrl + '/images/chocobo.png'
}
```

#### Notifier

To notify the user with the PeerTube ToastModule:

```js
function register (...) {
  const { notifier } = peertubeHelpers
  notifier.success('Success message content.')
  notifier.error('Error message content.')
}
```

#### Markdown Renderer

To render a formatted markdown text to HTML:

```js
function register (...) {
  const { markdownRenderer } = peertubeHelpers

  await markdownRenderer.textMarkdownToHTML('**My Bold Text**')
  // return <strong>My Bold Text</strong>

  await markdownRenderer.enhancedMarkdownToHTML('![alt-img](http://.../my-image.jpg)')
  // return <img alt=alt-img src=http://.../my-image.jpg />
}
```

#### Auth header

**PeerTube >= 3.2**

To make your own HTTP requests using the current authenticated user, use an helper to automatically set appropriate headers:

```js
function register (...) {
  registerHook({
    target: 'action:auth-user.information-loaded',
    handler: ({ user }) => {

      // Useless because we have the same info in the ({ user }) parameter
      // It's just an example
      fetch('/api/v1/users/me', {
        method: 'GET',
        headers: peertubeHelpers.getAuthHeader()
      }).then(res => res.json())
        .then(data => console.log('Hi %s.', data.username))
    }
  })
}
```

#### Plugin router route

**PeerTube >= 3.3**

To get your plugin router route, you can use `peertubeHelpers.getBaseRouterRoute()`:

```js
function register (...) {
  registerHook({
    target: 'action:video-watch.video.loaded',
    handler: ({ video }) => {
      fetch(peertubeHelpers.getBaseRouterRoute() + '/my/plugin/api', {
        method: 'GET',
        headers: peertubeHelpers.getAuthHeader()
      }).then(res => res.json())
        .then(data => console.log('Hi %s.', data))
    }
  })
}
```

#### Custom Modal

To show a custom modal:

```js
function register (...) {
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
}
```

#### Translate

You can translate some strings of your plugin (PeerTube will use your `translations` object of your `package.json` file):

```js
function register (...) {
  peertubeHelpers.translate('User name')
    .then(translation => console.log('Translated User name by ' + translation))
}
```

#### Get public settings

To get your public plugin settings:

```js
function register (...) {
  peertubeHelpers.getSettings()
    .then(s => {
      if (!s || !s['site-id'] || !s['url']) {
        console.error('Matomo settings are not set.')
        return
      }

      // ...
    })
}
```

#### Get server config

```js
function register (...) {
  peertubeHelpers.getServerConfig()
    .then(config => {
      console.log('Fetched server config.', config)
    })
}
```

#### Add custom fields to video form

To add custom fields in the video form (in *Plugin settings* tab):

```js
async function register ({ registerVideoField, peertubeHelpers }) {
  const descriptionHTML = await peertubeHelpers.translate(descriptionSource)
  const commonOptions = {
    name: 'my-field-name,
    label: 'My added field',
    descriptionHTML: 'Optional description',
    type: 'input-textarea',
    default: '',
    // Optional, to hide a field depending on the current form state
    // liveVideo is in the options object when the user is creating/updating a live
    // videoToUpdate is in the options object when the user is updating a video
    hidden: ({ formValues, videoToUpdate, liveVideo }) => {
      return formValues.pluginData['other-field'] === 'toto'
    }
  }

  for (const type of [ 'upload', 'import-url', 'import-torrent', 'update', 'go-live' ]) {
    registerVideoField(commonOptions, { type })
  }
}
```

PeerTube will send this field value in `body.pluginData['my-field-name']` and fetch it from `video.pluginData['my-field-name']`.

So for example, if you want to store an additional metadata for videos, register the following hooks in **server**:

```js
async function register ({
  registerHook,
  storageManager
}) {
  const fieldName = 'my-field-name'

  // Store data associated to this video
  registerHook({
    target: 'action:api.video.updated',
    handler: ({ video, body }) => {
      if (!body.pluginData) return

      const value = body.pluginData[fieldName]
      if (!value) return

      storageManager.storeData(fieldName + '-' + video.id, value)
    }
  })

  // Add your custom value to the video, so the client autofill your field using the previously stored value
  registerHook({
    target: 'filter:api.video.get.result',
    handler: async (video) => {
      if (!video) return video
      if (!video.pluginData) video.pluginData = {}

      const result = await storageManager.getData(fieldName + '-' + video.id)
      video.pluginData[fieldName] = result

      return video
    }
  })
}
```

#### Register settings script

To hide some fields in your settings plugin page depending on the form state:

```js
async function register ({ registerSettingsScript }) {
  registerSettingsScript({
    isSettingHidden: options => {
      if (options.setting.name === 'my-setting' && options.formValues['field45'] === '2') {
        return true
      }

      return false
    }
  })
}
```

#### HTML placeholder elements

PeerTube provides some HTML id so plugins can easily insert their own element:

```js
async function register (...) {
  const elem = document.createElement('div')
  elem.className = 'hello-world-h4'
  elem.innerHTML = '<h4>Hello everybody! This is an element next to the player</h4>'

  document.getElementById('plugin-placeholder-player-next').appendChild(elem)
}
```

See the complete list on https://docs.joinpeertube.org/api-plugins

#### Add/remove left menu links

Left menu links can be filtered (add/remove a section or add/remove links) using the `filter:left-menu.links.create.result` client hook.


### Publishing

PeerTube plugins and themes should be published on [NPM](https://www.npmjs.com/) so that PeerTube indexes take into account your plugin (after ~ 1 day). An official plugin index is available on [packages.joinpeertube.org](https://packages.joinpeertube.org/api/v1/plugins), with no interface to present packages.

> The official plugin index source code is available at https://framagit.org/framasoft/peertube/plugin-index

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
    "fr": "./languages/fr.json",
    "pt-BR": "./languages/pt-BR.json"
  },
  ...
}
```

The key should be one of the locales defined in [i18n.ts](https://github.com/Chocobozzz/PeerTube/blob/develop/shared/models/i18n/i18n.ts).

Translation files are just objects, with the english sentence as the key and the translation as the value.
`fr.json` could contain for example:

```json
{
  "Hello world": "Hello le monde"
}
```

### Build your plugin

If you added client scripts, you'll need to build them using webpack.

Install webpack:

```
$ npm install
```

Add/update your files in the `clientFiles` array of `webpack.config.js`:

```
$ $EDITOR ./webpack.config.js
```

Build your client files:

```
$ npm run build
```

You built files are in the `dist/` directory. Check `package.json` to correctly point to them.


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

> If you need to force your plugin update on a specific __PeerTube__ instance, you may update the latest available version manually:
> ```sql
> UPDATE "plugin" SET "latestVersion" = 'X.X.X' WHERE "plugin"."name" = 'plugin-shortname';
> ```
> You'll then be able to click the __Update plugin__ button on the plugin list.

### Unpublish

If for a particular reason you don't want to maintain your plugin/theme anymore
you can deprecate it. The plugin index will automatically remove it preventing users to find/install it from the PeerTube admin interface:

```bash
$ npm deprecate peertube-plugin-xxx@"> 0.0.0" "explain here why you deprecate your plugin/theme"
```

## Plugin & Theme hooks/helpers API

See the dedicated documentation: https://docs.joinpeertube.org/api-plugins


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
  * Don't try to require parent PeerTube modules, only use `peertubeHelpers`. If you need another helper or a specific hook, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues/new/choose)
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
