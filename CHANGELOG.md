# Changelog

## v2.3.0

**Since v2.2.0**

### IMPORTANT NOTES

 * Add `client_overrides` directory in configuration file. **You must configure it in your production.yaml**
 * Deprecate `/videos/abuse` endpoint.
A new endpoint to report videos will be created in PeerTube 2.4 and will also allow to report accounts and comments (`/videos/abuse` will be removed in 3.0)
 * Renamed videos blacklist feature to videos blocks/blocklist


### Documentation

 * Add feeds routes to the openapi spec **@rigelk**
 * Add notifications routes to the openapi spec **@rigelk**
 * Add redundancy routes to the openapi spec **@rigelk**
 * Add plugins routes to the openapi spec **@rigelk**
 * Add examples, descriptions and missing filters for abuses routes in the openapi spec **@rigelk**
 * Update CentOS insutructions in dependencies.md [@cgarwood82 in 2904](https://github.com/Chocobozzz/PeerTube/pull/2904)

### Maintenance

 * Switched image processing library from native dependency `sharp` to pure JS implementation `jimp`. Admins don't have to compile `sharp` anymore and `jimp` is lighter
 * Provide specific engine boundaries for NodeJS and Yarn [@rigelk in 0c4bacb](https://github.com/Chocobozzz/PeerTube/commit/0c4bacbff53bc732f5a2677d62a6ead7752e2405)
 * Add ability to set `database.name` config option [@gramakri in #2898](https://github.com/Chocobozzz/PeerTube/pull/2898)


### Docker

 * Fix `POSTGRES` env variables in docker-compose ([@kimsible in #2538](https://github.com/Chocobozzz/PeerTube/pull/2538/files))
 * Fix OpenDKIM permissions in docker-compose setup [@kimsible in #2868](https://github.com/Chocobozzz/PeerTube/pull/2868)


### Official PeerTube plugins

 * [Auto block videos (alpha)](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auto-block-videos)


### Plugins/Themes/Embed API

  * Add ability to override client assets: logo - favicon - PWA icons - PWA manifest name and description [@kimsible in #2897](https://github.com/Chocobozzz/PeerTube/pull/2897)

### Features

 * :tada: Add global search support (has to be explicitely enabled by admins)
 * :tada: Add ability for admins to display a banner on their instance
 * :tada: Support Vietnamese and Kabyle languages. Also re-establish Occitan language locale despite lack of support in Angular
 * Federation:
   * Make federation of unlisted videos an instance-level server preference [@Tak in #2802](https://github.com/Chocobozzz/PeerTube/pull/2802)
   * Sort ActivityPub video object files by resolution in descending order (fix issue with Pleroma)
   * Send complete video description in ActivityPub video objects
 * Moderation:
   * Add ability to bulk delete comments of an account
   * Add ability to mute accounts from video miniature
   * Improve report modal: [@rigelk in #2842](https://github.com/Chocobozzz/PeerTube/pull/2842)
     * Add ability to provide predefined reasons
     * Embed of the video in the modal
     * Add ability to set a **startAt** parameter
 * Accessibility:
    * Add lang attribute in languages list menu [@Pandoraaa in #2832](https://github.com/Chocobozzz/PeerTube/pull/2832)
    * Add aria-hidden to non-descriptive icons [@Pandoraaa in #2844](https://github.com/Chocobozzz/PeerTube/pull/2844)
    * Change focus color instead of opacity of video play button [@Pandoraaa in #2845](https://github.com/Chocobozzz/PeerTube/pull/2845)
    * Add explicit step and aria-current attribute in register form [@Pandoraaa in #2861](https://github.com/Chocobozzz/PeerTube/pull/2861)
    * Add scope tags and aria-labels in instance features table [@Pandoraaa in #2866](https://github.com/Chocobozzz/PeerTube/pull/2866)
    * Add keyboard navigation in video watch page buttons [@Pandoraaa in #2854 with @rigelk](https://github.com/Chocobozzz/PeerTube/pull/2854)
  * Replaced softies icons by feather icons **@rigelk**
  * Support player hotkeys when it is not focused
  * Improve video miniature grids to fill the space as much as possible **@rigelk**
  * Add video miniature dropdown in *Discover* page
  * Add channel information in *My videos* page
  * Add videos count per channel in *My channels* page
  * Improve channel deletion warning by explaining how many videos will be deleted
  * Simplify navigation within most admin menus **@rigelk**
  * Tracker:
    * Log IP requesting unknown infoHash [@JohnXLivingston in
212e17a ](https://github.com/Chocobozzz/PeerTube/commit/212e17a1892162a69138c0b9c0a1bd88f95209a8)
    * Block IP of infohash spammers [db48de8](https://github.com/Chocobozzz/PeerTube/commit/db48de8597897e5024f8e9ed5acb1a8f40748169)
  * Allow limiting video-comments rss feeds to an account or video channel [@rigelk in 00494d6](https://github.com/Chocobozzz/PeerTube/commit/00494d6e2ae915741f47869dcd359d9728a0af91)

### Bug fixes

  * Fix default anonymous theme that should use instance default
  * Fix configuration form issue when auto follow index URL is empty
  * Fix URL import of some videos
  * Fix quota representation in profile settings  **@rigelk**
  * Exclude 0p from auto webtorrent quality
  * Fix scroll on some pages with hash in URL
  * Fix search filter in video reports
  * Fix anonymous user nsfw policy
  * Don't cache embed HTML page resulting in broken embed after a PeerTube upgrade
  * Accessibility:
    * Add lang in document to match current locale [@rigelk in #2822](https://github.com/Chocobozzz/PeerTube/pull/2822)
    * Prevent duplicate id attributes for `.svg` [@rigelk in #2822](https://github.com/Chocobozzz/PeerTube/pull/2822)
    * Fix headings order or add missing ones [@Pandoraaa in #2871](https://github.com/Chocobozzz/PeerTube/pull/2871)
    * Remove uneccessary details to link titles  [@Pandoraaa in #2879](https://github.com/Chocobozzz/PeerTube/pull/2879)
    * Fix accessibility action buttons and display on imports and followers list [@kimsible in #2986](https://github.com/Chocobozzz/PeerTube/pull/2986)
 * Fix iOS player with HLS-only videos
 * Fix action buttons selection mode styles [@kimsible in #2983](https://github.com/Chocobozzz/PeerTube/pull/2983)


**Since v2.3.0-rc.1**

### Bug fixes

  * Fix broken locales
  * Fix embed URL in share modal
  * Handle webp images from youtube-dl
  * Fix iOS player with HLS-only videos
  * Fix popup issues on video miniature click when searching on the global index
  * Fix username in password-reset email [@kimsible in #2960](https://github.com/Chocobozzz/PeerTube/pull/2960)
  * Fix maximized icon padding in markdown textarea [@kimsible in #2963](https://github.com/Chocobozzz/PeerTube/pull/2963)
  * Fix action buttons selection mode styles [@kimsible in #2983](https://github.com/Chocobozzz/PeerTube/pull/2983)
  * Fix user creation in admin [@kimsible in #2985](https://github.com/Chocobozzz/PeerTube/pull/2985)
  * Fix accessibility action buttons and display on imports and followers list [@kimsible in #2986](https://github.com/Chocobozzz/PeerTube/pull/2986)


## v2.2.0

**Since v2.1.0**

## IMPORTANT NOTES

 * **/!\ VERY IMPORTANT /!\\** We added a unique index on actors usernames to fix some federation bugs.
 Please check now if you have conflicts:
    * Go inside your database using `sudo -u postgres psql peertube_prod` and run `select "preferredUsername" from actor where "serverId" is null group by "preferredUsername" having count(*) > 1;`
    * If you have some results, it seems you have duplicate channels/accounts.
    For every entry, you'll have to change the preferredUsername of the entry you want (so they are unique).
    The updated actors could have some federations issues
 * Changed `auto_follow_index` setting configuration: you now have to use the complete URL in `index_url`.
 If you used the default one, you now need to use `https://instances.joinpeertube.org/api/v1/instances/hosts`.
 This way, you can also use a direct raw URL (Gitlab, Github, pastebin, etc.) using [a simple text format](https://framagit.org/framasoft/peertube/instances-peertube#peertube-auto-follow) and easily maintain small communities or instance recommendation lists.
 * PeerTube requires NodeJS v10 or v12

### CLI tools

 * Add redundancy CLI: https://docs.joinpeertube.org/#/maintain-tools?id=peertube-redundancyjs
 * Add ability to pass remaining options to youtube-dl binary in peertube-import script ([@drzraf](https://github.com/drzraf))

### Docker

 * **Important** Fix HLS storage configuration ([@xcffl](https://github.com/xcffl)): https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/config/production.yaml#L48
 * Add DKIM support to Docker ([@kimsible](https://github.com/kimsible))

### Maintenance

 * Add nginx configuration to redirect videos to an S3 bucket ([@rigelk](https://github.com/rigelk)) and update of the [corresponding documentation](https://docs.joinpeertube.org/#/admin-remote-storage).

### Plugins/Themes/Embed API

 * Add embed API (https://docs.joinpeertube.org/#/api-embed-player):
   * `playbackState` can be `ended`
   * `playbackStatusUpdate` has a `duration` field
   * `setCaption` and `getCaptions` methods
 * Add client plugin hooks (https://docs.joinpeertube.org/#/api-plugins):
   * `action:login.init`
   * `action:video-watch.video-threads.loaded`
   * `action:video-watch.video-thread-replies.loaded` ([@ipbc-dev](https://github.com/ipbc-dev))
 * Add server plugin hooks (https://docs.joinpeertube.org/#/api-plugins):
   * `filter:api.video.pre-import-url.accept.result`
   * `filter:api.video.pre-import-torrent.accept.result`
   * `filter:api.video.post-import-url.accept.result`
   * `filter:api.video.post-import-torrent.accept.result`
 * Add server helpers:
   * `database.query` to do SQL queries
   * `videos.removeVideo`
   * `config.getWebserverUrl`
   * `moderation.blockServer`, `moderation.unblockServer`, `moderation.blockAccount`, `moderation.unblockAccount`, `moderation.blacklistVideo`, `moderation.unblacklistVideo`
 * Add client helpers:
   * `notifier` to notify users using the toast component ([@kimsible](https://github.com/kimsible))
   * `showModal` to show a modal ([@kimsible](https://github.com/kimsible))
   * `markdownRenderer` to render markdown ([@kimsible](https://github.com/kimsible))
 * Add ability for plugins to define custom routes
 * Add ability for plugins to remove video/playlist privacies
 * Add ability for plugins to support additional auth methods
 * Add `onSettingsChange` support

### Official PeerTube plugins

 * [OpenID Connect](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-openid-connect)
 * [LDAP](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-ldap)
 * [SAML2](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auth-saml2)
 * [Auto mute accounts/instances (alpha)](https://framagit.org/framasoft/peertube/official-plugins/-/tree/master/peertube-plugin-auto-mute)

## Features

 * :tada: Add HTML support in PeerTube emails, improve text-only version ([@rigelk](https://github.com/rigelk))
 * :tada: Add settings panel for anonymous users so they can change NSFW/P2P/autoplay/displayed videos policy ([@rigelk](https://github.com/rigelk))
 * :tada: Improve redundancy management:
   * Add quick action on video miniature to mirror a specific video using the web interface
   * Add admin dashboard to list remote and local redundancies
   * Add ability for admins to define remote redundancies policy (accept/reject)
 * :tada: Many responsive & UI improvements:
   * Add maximized mode to markdown textarea ([@kimsible](https://github.com/kimsible))
   * Detect and prevent sub menu overflow on small screens using a dropdown or a modal ([@rigelk](https://github.com/rigelk))
   * Use a typeahead component for the search bar ([@rigelk](https://github.com/rigelk))
   * Use a modal instead of a dropdown menu in small/mobile views ([@kimsible](https://github.com/kimsible))
   * Improve display of accounts and channel pages on small and medium screens ([@rigelk](https://github.com/rigelk))
   * Improve forms layout ([@rigelk](https://github.com/rigelk))
   * Replace helpers icons with descriptions in admin configuration ([@rigelk](https://github.com/rigelk))
   * Improve tables on mobile devices to prevent layout breakage ([@kimsible](https://github.com/kimsible))
   * Fix multiple broken views on small screens ([@kimsible](https://github.com/kimsible))
   * Make video add tabs scrollable on small devices ([@kimsible](https://github.com/kimsible))
   * Better use of space and icons in the plugin administration interface ([@rigelk](https://github.com/rigelk))
   * Restyle toast notifications to tone down colors ([@rigelk](https://github.com/rigelk))
   * Add/move links at the bottom of the left menu ([@rigelk](https://github.com/rigelk))
   * Improve avatar upload UI ([@rigelk](https://github.com/rigelk))
   * Use progress bars for quota used in my account ([@rigelk](https://github.com/rigelk))
   * Add variable pagination size to all tables ([@rigelk](https://github.com/rigelk))
   * Add empty states to all tables ([@rigelk](https://github.com/rigelk))
   * Add generic text filter to all admin tables ([@rigelk](https://github.com/rigelk))
   * Fix `z-index` for tooltips, modals and their button to prevent overlaps ([@rigelk](https://github.com/rigelk))
   * And many others!
 * :tada: Improve video abuses admin table ([@rigelk](https://github.com/rigelk)):
   * Add in-text specific search filters
   * Reports can be linked to directly
   * Rich reporter field
   * Add video thumbnail with abuse count for the video and position of the abuse in that list
   * Expand row to see more information about the video, the reporter and the reportee
   * Add many actions (on the video, on the reporter)
   * Don't remove a report when a video is deleted
 * Add information on a video abuse within its notification email ([@rigelk](https://github.com/rigelk))
 * Add ability for video owners to delete comments
 * Add filter inputs for blacklisted videos and muted accounts/servers ([@rigelk](https://github.com/rigelk))
 * Video import improvements:
   * Support subtitles when importing a video ([@kimsible](https://github.com/kimsible))
   * Generate thumbnail/preview from URL and inject them in the video edit form ([@kimsible](https://github.com/kimsible))
   * Support `licence` and `language` fields
   * Support audio file imports
 * Support WMA and WAV audio files upload
 * Support drag and drop for video upload/torrent import ([@rigelk](https://github.com/rigelk))
 * Add video file metadata to download modal ([@rigelk](https://github.com/rigelk))
 * Add views stats for channels ([@rigelk](https://github.com/rigelk))
 * Add more information about the user in the edit form ([@rigelk](https://github.com/rigelk))
 * Server optimizations:
   * Add cache for some immutable models
   * Don't refresh videos when processing a view
   * Optimize view endpoint
   * Completely rewritten SQL query to list videos
   * Optimize SQL request when broadcasting an activity
 * Support infinite scrolling in the discover page
 * Add ability for admins to create a user without a password. PeerTube will send a reset password link to the user ([@JohnXLivingston](https://github.com/JohnXLivingston))
 * Improve embed title background opacity
 * Add origin instance URL in watch page
 * Clearer description of advanced search options
 * Always copy full actor handle in video channels view ([@rigelk](https://github.com/rigelk))
 * Add `sendmail` support ([@immae](https://github.com/immae)) to `smtp` configuration
 * Support `rel="me"` links in markdown
 * Use `originallyPublishedAt` from body on import if it exists
 * Sort outbox by *DESC createdAt* order
 * Increase video comment max length limit

### Bug fixes

 * Update default user theme to `instance-default` (Jorge Silva)
 * Fix user dropdown menu with long texts ([@rigelk](https://github.com/rigelk))
 * Fix load more comments on infinite scroll ([@ipbc-dev](https://github.com/ipbc-dev))
 * Fix CSP issue on WebFinger service ([@ZanyMonk](https://github.com/ZanyMonk))
 * Fix federation with Pleroma
 * Fix Safari and iOS  video play
 * Fix broken HLS player on old Edge
 * Fix running HLS transcoding on existing HLS video
 * Fix user role edition
 * Fix video duration display
 * Fix error when adding a video in a playlist that does not have a thumbnail
 * Fix internal video display in playlists
 * Fix add comment in threads with deleted comments
 * Fix video codec in HLS playlist resulting in a broken video
 * Fix torrent import on Windows
 * Respect browser autoplay policy: don't autoplay videos in mute mode
 * Fix playlist videos autoplay/next play ([@rigelk](https://github.com/rigelk))
 * Fix admin table column invalid sort error
 * Fix outbox crawling max page/timeout (when an admin follows an instance with many videos)
 * Add CORS to ActivityPub routes
 * Fix my video imports table display when a video gets deleted ([@rigelk](https://github.com/rigelk))
 * Fix peertube/import scripts `comment-enabled`, `wait-transcoding` and `download-enabled` options
 * Don't leak unlisted videos in comments feed
 * Do not display deleted comments or muted accounts/instances in RSS feed
 * Fix HLS audio only transcoding
 * Fix playlist creation/update with a long description
 * Fix links of same instance in video description
 * Fix REPL script
 * Fix broken client when cookies are disabled
 * Fix upload button color in dark mode
 * Explicit theme colors for inputs and textarea
 * Fix input/textarea themes
 * Fix action button icons theme
 * Fix grey color theme
 * Fix regression scrollbar bgcolor mdtextarea maximized-mode ([@kimsible](https://github.com/kimsible))


**since v2.2.0-rc.1**

### Bug fixes

 * Fix broken migration introduced in 2.2.0-rc.1 in docker
 * Fix sort icons in tables
 * Fix action button overflow in tables
 * Fix broken client when cookies are disabled
 * Fix upload button color in dark mode
 * Explicit theme colors for inputs and textarea
 * Fix input/textarea themes
 * Fix dropdown menu overflow
 * Fix notifications with dark theme
 * Fix action button icons theme
 * Fix grey color theme
 * Fix regression scrollbar bgcolor mdtextarea maximized-mode ([@kimsible](https://github.com/kimsible))
 * Fix broken emails



## v2.1.1

### Bug fixes

 * Fix youtube-dl in docker image
 * Fix playlist creation/update
 * Fix fetch of instance config in client
 * Manual approves followers only for the instance (and not accounts/channels)
 * Fix avatar update
 * Fix CSP for embeds
 * Fix scroll of the menu on mobile
 * Fix CPU usage of PostgreSQL
 * Fix embed for iOS


## v2.1.0

**Since v2.0.0**

### IMPORTANT NOTES

 * **/!\ VERY IMPORTANT /!\\** You need to execute manually a script (can be executed after your upgrade, while your PeerTube instance is running) to create HLS video torrents:
   * `cd /var/www/peertube/peertube-latest && sudo -u peertube NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production node dist/scripts/migrations/peertube-2.1.js`
 * **/!\ VERY IMPORTANT /!\\** In the next PeerTube release (v2.2.0), we'll add a unique index on actors usernames to fix some federation bugs.
 Please check now if you have conflicts using:
    * Go inside your database using `sudo -u postgres psql peertube_prod` and run `select "preferredUsername" from actor where "serverId" is null group by "preferredUsername" having count(*) > 1;`
    * If you have some results, it seems you have duplicate channels/accounts.
  For every entry, you'll have to change the preferredUsername of the entry you want (so they are unique).
  The updated actors could have some federations issues
 * We now use Buster for the docker image, so the image name changed:
   * `production-stretch` becomes `production-buster`
   * `v2.x.x-stretch` becomes `v2.x.x-buster`
 * Users cannot create more than 20 channels now to avoid UX and actor name squatting issues
 * We added a warning if the `videos` directory is the same than the `redundancy` one in your configuration file: it can create some bugs

### Documentation

We added some sections in the documentation website:

 * S3 remote storage: https://docs.joinpeertube.org/#/admin-remote-storage
 * Instances redundancy: https://docs.joinpeertube.org/#/admin-following-instances
 * Moderate your instance: https://docs.joinpeertube.org/#/admin-moderation
 * Customize your instance (install plugins & themes): https://docs.joinpeertube.org/#/admin-customize-instance
 * PeerTube logs (standard log/audit log): https://docs.joinpeertube.org/#/admin-logs
 * Mute accounts/instances: https://docs.joinpeertube.org/#/use-mute
 * Controlled player embed API: https://docs.joinpeertube.org/#/api-embed-player

### Docker

 * Sticking to one env-var management system ([@Leopere](https://github.com/Leopere)) (See https://github.com/Chocobozzz/PeerTube/pull/2247)
 * Simplify Dockerfile and slim Docker image ([@Nutomic](https://github.com/nutomic))
 * Add HLS support in Docker container by using the latest Debian stable (Buster) image

### Plugins/Themes API

 * Add checkbox and textarea as possible input types for settings ([@rigelk](https://github.com/rigelk))
 * Add `isLoggedIn` helper to client plugins ([@rigelk](https://github.com/rigelk))
 * Add client plugin hooks:
   * `action:video-watch.player.loaded` with player instance
   * `action:video-watch.video.loaded` with a videojs instance
   * `action:signup.register.init` ([@rigelk](https://github.com/rigelk))
   * `filter:api.signup.registration.create.params` ([@rigelk](https://github.com/rigelk))
   * `filter:internal.video-watch.player.build-options.params`
   * `filter:internal.video-watch.player.build-options.result`
   * `filter:internal.common.svg-icons.get-content.params`
   * `filter:internal.common.svg-icons.get-content.result`
 * Add server plugins hooks:
   * `action:api.user.blocked`
   * `action:api.user.unblocked`
   * `action:api.user.registered`
   * `action:api.user.created`
   * `action:api.user.deleted`
   * `action:api.user.updated`
   * `action:api.user.oauth2-got-token`
 * Accept `.` `_` and `0-9` characters in plugin names

### Maintenance

 * PeerTube moved translations from Zanata to Weblate. Here is the new translations website URL: https://weblate.framasoft.org/projects/peertube/
 * We now provide a JavaScript library to control a PeerTube embed: https://www.npmjs.com/package/@peertube/embed-api
 * Add ability to generate HLS videos using `create-transcoding-job` script (see [the documentation](https://docs.joinpeertube.org/#/maintain-tools?id=create-transcoding-jobjs))
 * Update nginx template: (you need to [update manually](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md#nginx))
   * Add streaming playlists endpoint
   * Add `client_body_temp_path` hint
   * Relax TLS/SSL ciphers hardening to allow Android 4.4.2 to use the PeerTube instance API
 * Add `maxFileSize`, `maxFiles` and `anonymizeIP` log options in configuration file

### Features

 * :tada: Add *internal* video privacy mode. *Internal* videos are only available to other logged in users of your instance, and are not federated
 * :tada: Add hyperlink video timestamps in comments & video descriptions ([@Lesterpig](https://github.com/lesterpig) & [@rigelk](https://github.com/rigelk))
 * :tada: Comments improvements:
   * Support basic markdown
   * Soft delete video comments instead of destroying them ([@alcalyn](https://github.com/alcalyn))
   * Add commentator name alongside fid for video comments ([@rigelk](https://github.com/rigelk))
   * Add a cancel button in comment form ([@rigelk](https://github.com/rigelk))
   * Show number of comments under a video in watch page ([@rigelk](https://github.com/rigelk))
   * Add user moderation dropdown ([@rigelk](https://github.com/rigelk))
   * Add ability to sort comments by *total replies* or *created date* ([@rigelk](https://github.com/rigelk))
   * Add *total replies from video author* indicator ([@rigelk](https://github.com/rigelk))
   * Comment name emphasis for video author ([@rigelk](https://github.com/rigelk))
 * Add "Watch later" button in video miniature overlay ([@rigelk](https://github.com/rigelk))
 * Add ability to transcode videos in an audio only video container ([@Yetangitu](https://github.com/Yetangitu))
 * Add playlist search input in *add to playlist* dropdown ([@rigelk](https://github.com/rigelk))
 * Add search bars for a user's videos and playlists ([@rigelk](https://github.com/rigelk))
 * Support playlists in share modal
 * Better UI for a better world:
   * Add play/pause bezels to the video player ([@rigelk](https://github.com/rigelk))
   * Use icons instead of buttons in watch page (like/dislike, support...) ([@rigelk](https://github.com/rigelk))
   * Improve *PeerTube* section in About page and add links to the documentation
   * Improve comment tree in Watch page
   * Improve dropdown box shadow ([@rigelk](https://github.com/rigelk))
   * Add channel avatar to watch view ([@rigelk](https://github.com/rigelk))
   * Improve likes-dislikes bar usability
   * Alter titles section header style ([@rigelk](https://github.com/rigelk))
   * Enhance jobs list display on smaller screens ([@alcalyn](https://github.com/alcalyn))
   * Add a button in the videos from subscriptions page to manage subscriptions ([@rigelk](https://github.com/rigelk))
   * Add duration to video attributes in watch view ([@rigelk](https://github.com/rigelk))
   * Add a message in the login form when signup is disabled for people that are looking for an account ([@rigelk](https://github.com/rigelk))
   * Add "Manage" button in owned account and channels pages ([@rigelk](https://github.com/rigelk))
   * Improve password input accessibility ([@rigelk](https://github.com/rigelk))
   * Add descriptions in moderation dropdown ([@rigelk](https://github.com/rigelk))
 * Performances improvements:
   * Lazy load categories, licences, languages and video/playlist privacies in the client
   * Only update remote actor avatar if the filename changed
   * Optimize transcoding by using the lowest resolution as input file
   * Speedup embed first paint
   * Optimize videos list SQL query
   * Optimize local videos list SQL query
   * Cache `peertube` instance actor SQL result
   * Cache HLS/WebTorrent InfoHash SQL result
   * Optimize notification endpoint on specific cases
   * Optimize "list my playlists" SQL query
 * Improve search filters: ([@rigelk](https://github.com/rigelk))
   * Add ability to sort results
   * Improve tags filter inputs
   * Add a button to reset filters
 * Improve autoplay: ([@rigelk](https://github.com/rigelk))
   * Autoplay next video switch for both user and visitors
   * Add *up next* screen on autoplay
   * Autoplay next video support for playlists
   * Add *next* video button to the player
   * Add loop setting when watching a playlist
 * Add option to download subtitles in download modal ([@rigelk](https://github.com/rigelk))
 * Add a button in account page to follow all account channels ([@rigelk](https://github.com/rigelk))
 * Add ability to search a video directly by its UUID
 * Case insensitive tags search
 * Add ability to disable WebTorrent (and only enable HLS) (**experimental and breaks federation with PeerTube instances < 2.1**)
 * Don't seed if the client is on a cellular network in the HLS player
 * Load HLS player in embed by default if enabled
 * Admin panels:
   * Add ability to sort by *state*, *score* and *redundancy allowed* columns in following/followers admin table
   * Add ability to filter per job type in admin
   * Add *Audit logs* section in admin Logs panel
 * Improve Media-RSS support ([@rigelk](https://github.com/rigelk))
 * Explicit the tag limit in video form ([@bikepunk](https://github.com/bikepunk))
 * Add a warning when uploading videos using root
 * Clearer video quota label in user settings
 * Pause the video when the user opens a modal
 * Handle basic HTML in account descriptions
 * Support `m4v` videos
 * Improve 4k resolution bitrate
 * Add missing hotkeys documentation in the watch page
 * Add a button to copy the channel handle ([@rigelk](https://github.com/rigelk))
 * Add server config to the nodeinfo metadata ([@rigelk](https://github.com/rigelk))
 * Improve notification popup interactivity ([@rigelk](https://github.com/rigelk))

### Bug fixes

 * Don't notify if the account in on a muted instance
 * Don't leak other notified addresses in notification emails
 * Allow the embed iframe to open links
 * Add missing button roles for the language chooser and keyboard shortcut menu items [@MarcoZehe](https://github.com/MarcoZehe)
 * Fix overflow when creating a channel
 * Fix "copy magnet URI" in player
 * Fix text overflow in menu
 * Fix player focus
 * Only display accepted followers/followings instances in about page
 * Fix brackets truncation in video description
 * Fix channel playlist miniatures overflow
 * Fix background color on some screens
 * Fix captions upload issue depending on the caption name
 * Fix file download when the video is private
 * Fix dropdown on video miniature for unlogged users
 * Fix video support field in update form
 * Fix video import having a long thumbnail url (Facebook for example)
 * Add correct HTTP status on not found video
 * Fix bug on login when username has a special character (`_` for example)
 * Fix plugin unregistration that did not remove properly its hooks ([@JohnXLivingston](https://github.com/JohnXLivingston))
 * Fix wrong audio only resolution label for hls
 * Fix AP icon URL for imported videos
 * Fix octet stream fallback for video ext

**since v2.1.0-rc.1**

### Bug fixes

 * Fix wrong audio only resolution label for hls
 * Fix AP icon URL for imported videos
 * Fix embed on mastodon
 * Fix octet stream fallback for video ext


## v2.0.0

**Since v1.4.1**

### IMPORTANT NOTES

 * Removed old JSON LD signature implementation. There will be some **federation incompatibilities** with forwarded activities sent
  by PeerTube instances < v2.0.0
 * Replaced configuration key `email.object` with `email.subject`: https://github.com/Chocobozzz/PeerTube/commit/916937d7daf386e4e2d37b2ca22db07b644b02df

### Plugins/Themes API

 * Add plugin hook on registration `filter:api.user.signup.allowed.result`

### Docker

 * Fix traefik version docker compose (**you need to update your `docker-compose.yml` file**: https://github.com/Chocobozzz/PeerTube/commit/f1b38883922fd59b36f093e44a5091e090d20862)

### Maintenance

 * Add `--tmpdir`, `--first`, `--last` and `--verbose [level]` parameters to peertube-import-videos script ([@Yetangitu](https://github.com/Yetangitu))
 * Improve REST API documentation ([@frankstrater](https://github.com/frankstrater))
 * Improve plugin management documentation

### Features

 * Better instance admin responsibility:
   * Add ability to set more information about your instance. This will be used in the future on https://joinpeertube.org to help people find
   the appropriate PeerTube instance on which they can register:
     * Main **Categories**
     * **Languages** you/your moderators speak
     * **Code of Conduct**
     * **Moderation information** (who moderates your instance, NSFW policy etc)
     * Who is **behind the instance** (a single person? non-profit?)
     * Why did the admin **create this instance**
     * How long the admin plan to **maintain the instance**
     * How the administrator **will finance** the PeerTube server
     * **Hardware** information
   * Add these information in the about page and in the signup page
   * Add a welcome modal at first admin login with some explanations of PeerTube and some useful links
   * Add warning modal when administrators enable or enabled signup but did not fill some important instance information
   (for now the instance **name**, **terms**, **administrator** and **maintenance lifetime** information)
 * Add ability to automatically follow back other instances
 * Add ability to automatically follow [the public registry](https://instances.joinpeertube.org/) instances
 * Add *Most liked videos* page ([@alcalyn](https://github.com/alcalyn))
 * Add a drag&drop delay on playlist videos to allow user scroll on small screens ([@alcalyn](https://github.com/alcalyn))
 * Allow to toggle video publication date to display absolute date ([@alcalyn](https://github.com/alcalyn))
 * Add statistics in about page ([@alcalyn](https://github.com/alcalyn))
 * Improve the *feature table* in about page
 * Add contributors in about page
 * Clearer warning of IP address leaking on embedded videos ([@robinkooli](https://github.com/robinkooli))
 * Case insensitive search on video tags
 * Add video name in "video publish notification"
 * Add ability to autoplay next recommended video (opt in) ([@LoveIsGrief](https://github.com/LoveIsGrief))
 * Add link behind the subscribe via RSS button ([@frankstrater](https://github.com/frankstrater))
 * Support text/plain caption files
 * Speedup theme injection
 * Add ability to enable HLS in the admin panel

### Bug fixes

 * Fix audio upload
 * Handle video reports from mastodon
 * Fix videos redundancy exceeding the limit
 * Fix search when user defined video languages in their preferences
 * Don't quick transcode with the wrong pixel format
 * Hide videos abuses of muted accounts
 * Fix account avatar widths
 * Fix default `commentsEnabled` and `downloadEnabled` values on video upload/import ([@frankstrater](https://github.com/frankstrater))
 * Disable auto complete of email field when editing another user information in admin panel ([@Knackie](https://github.com/Knackie))
 * Fix federation issues with some actors (that have long descriptions, or missing optional AP fields)
 * Remove down redundancy endpoints in HLS player
 * Fix user notifications with multiple opened tabs
 * Replace "overview" by "discover" in webpage titles
 * Clearer IP debug message in admin panel
 * Fix checkbox styles when using a theme
 * Don't redirect on verify account page after login
 * Fix player captions menu after choosing a subtitle
 * Fix CLI scripts with URLs ending with a `/`
 * Fix `--since` and `--until` timezone in `peertube-import-videos` script
 * Avoid circular error in logger
 * Fix start/stop of first element when loading a playlist

***Since v2.0.0-rc.1***

### Features

 * Improve welcome/warning modals
 * Add ability to enable HLS in the admin panel

### Bug fixes

 * Fix auto index follow
 * Fix CLI scripts with URLs ending with a `/`
 * Fix `--since` and `--until` timezone in `peertube-import-videos` script ([@fflorent](https://github.com/fflorent))
 * Avoid circular error in logger
 * Fix start/stop of first element when loading a playlist


## v1.4.1

### Bug fixes

 * Fix too fast redundancy eviction
 * Fix broken auto blacklist page
 * Rename signup steps
 * Fix menu x overflow


## v1.4.0

**Since v1.3.1**

### IMPORTANT NOTES

 * **Important** Add `plugins` directory in configuration file. **You should configure it in your production.yaml**
 * **Important:** Deprecate NodeJS 8 (support ends on [December 2019](https://github.com/nodejs/Release#release-schedule)). Please upgrade to NodeJS 10.
 * **Important:** Updated nginx template (you need to [update manually](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md#nginx))
   * Fix long server responses on dual stack servers: https://github.com/Chocobozzz/PeerTube/commit/fd2ddcae8ff4eb10bf7168ac3c8801f06b37627f
   * Improve images HTTP cache: https://github.com/Chocobozzz/PeerTube/commit/c928e1364fbdff87f27fd982710b95426a250491
 * **Important:** With the new theme system, we removed the dark mode button. Your administrator has to install [the dark theme](https://framagit.org/framasoft/peertube/official-plugins/tree/master/peertube-theme-dark)
 from their admin panel, and then users can choose this theme in their settings
 * Changed the playlist REST API to fix various issues. See https://github.com/Chocobozzz/PeerTube/pull/1998 for more information
 * Removed magnet URI support in download modal since most of the BitTorrent clients do not understand the `xs` parameter
 * Renamed `Overview` page to `Discover`

### Security

 * Moderators can only create and update regular users (thanks GGC-Project)

### Maintenance

 * Create a dedicated `package.json` for CLI tools to reduce server dependencies size
 * Add ability to set root password by environment at first start ([@darnuria](https://github.com/darnuria))
 * Removed unused `uuid` actor field (we already have a unique identifier that is the `preferredUsername`)
 * Add ability to disable PeerTube log rotation ([@NassimBounouas](https://github.com/NassimBounouas))
 * Speedup font display ([@BO41](https://github.com/BO41))
 * Improve static files HTTP cache
 * Add `--since` and `--until` parameters to import videos script to easily sync external channels ([@fflorent](https://github.com/fflorent))
 * Optimize `/watch/:uuid` endpoint
 * Optimize Sequelize (SQL ORM) queries generation (consumes less CPU)
 * Prune script is faster and can prune avatar files

### Features

 * :tada: Support Finnish, Greek and Scottish Gaelic languages
 * :tada: Add basic plugins and themes support (**beta**): https://docs.joinpeertube.org/#/contribute-plugins
   * Install plugins or themes from the administration panel
   * Choose a default theme for your instance
   * Users can choose the theme they want among the list of themes their administrator installed
 * :tada: Add ability to upload audio files: PeerTube will merge the audio file and the thumbnail to create a video
 * Multi step registration:
   * Add ability for new users to create their default channel
   * Guess the account username/channel username according to their display name
   * Add explanations about what the purpose of a username/channel name is, and what a channel is
 * Improve account video channels page:
   * Set it as the default page for the account page in order to avoid confusion between the account homepage and the video channel homepage
   * Display channels in rows with some of their videos
 * Support more URL parameters in embeds: `muted`, `loop`, `peertubeLink`
 * Redesign share modal and add customizations:
   * Start/stop at a specific timestamp
   * Automatically play/mute/loop the video
   * Set a specific subtitle by default
 * Group subscriptions and recently added videos in chronological order
 * Add ability for users to change their email address
 * Add ability to update the support field of all channel videos when we update the channel support field
 * Add a language filter in user preferences to display only videos in specific languages
 * Add instance follows list in a dedicated tab in the "About" page
 * Add ability to set to private a public/unlisted video or video playlist
 * Transcode in the `tmp` directory for s3fs compatibility ([@libertysoft3](https://github.com/libertysoft3))
 * Add a button to copy account username ([@NassimBounouas](https://github.com/NassimBounouas))
 * Redirect to "Local videos" page when going to the `peertube` account page
 * Rearrange search filter options ([@realityfabric](https://github.com/realityfabric))
 * Close modal after clicking on download ([@LeoMouyna](https://github.com/LeoMouyna))
 * Add ability for admins to customize emails object prefix and body signature ([@yohanboniface](https://github.com/yohanboniface))
 * Support 4K transcoding
 * Add link of the follower profile in administration ([@NassimBounouas](https://github.com/NassimBounouas))
 * Add subject field in contact form ([@NassimBounouas](https://github.com/NassimBounouas))
 * Add rate limit to registration and API endpoints
 * Add "video quota used" sortable column in user admin list ([@darnuria](https://github.com/darnuria))
 * Automatically update the playlist thumbnail according to the video at the first position (if the user did not set a specific thumbnail)
 * Automatically remove dead followings
 * Federate comment deletion if the comment was deleted by the video owner

### Bug fixes

 * Fix transcoding information in features table ([LiPek](https://github.com/LiPeK))
 * Fix tools auth with remote instances
 * Fix various issues in upload/import scripts
 * Fix redundancy exceeded quota
 * Fix login with email ([@NassimBounouas](https://github.com/NassimBounouas))
 * Fix quota display in features table
 * Fix transcoding help placement
 * Fix invisible videos in playlists
 * Fix HLS transcoding in lower resolutions
 * Fix various federation issues
 * Fix mute badge labels
 * Fix broken follow notification when the actor is deleted
 * Fix overflow and playlist block width in the watch page
 * Fix search results overflow on mobile
 * Fix infinite scroll on big screens
 * Fix start time on some HLS videos
 * Fix socket notification with multiple user tabs
 * Fix redundancy if the instance has already the file on disk
 * Fix image and plugin CSP
 * Fix video rows overflow
 * Dismiss modals on pop state
 * Go back when cancel NSFW modal


***Since v1.4.0-rc.1***

### Features

 * Add Finnish language support

### Bug fixes

 * Fix broken front end on Firefox ESR (60)
 * Fix prune storage script when using a same directory for multiple storage keys
 * Relax plugin `package.json` validation
 * Replace "overview" by "discover" in client titles
 * Change configuration: `email.object` becomes `email.subject`
 * Fix user creation by moderators
 * Fix video playlist element removal
 * Fix plugin card background color with dark theme
 * Fix lazy static route with unknown avatars (404 instead of 500)
 * Fix socket notification with multiple user tabs
 * Fix redundancy if the instance has already the file on disk
 * Fix image and plugin CSP
 * Fix video rows overflow
 * Dismiss modals on pop state
 * Go back when cancel NSFW modal


## v1.3.1

### Bug fixes

 * Fix Mastodon remote interactions
 * Fix missing video download button
 * Fix error in video upload/update form when scheduling publication
 * Fix black theme on some pages
 * Fix video import if auto blacklist is enabled


## v1.3.0

**Since v1.2.0**

### IMPORTANT NOTES

 * **nginx** Remove `text/html` from `gzip_types`: https://github.com/Chocobozzz/PeerTube/commit/7eeb6a0ba4028d0e20847b846332dd0b7747c7f8 [@bnjbvr](https://github.com/bnjbvr)
 * Add `streaming_playlists` directory in configuration file. **You should configure it in your production.yaml**
 * CSP configuration changed: it's now in a [dedicated section](https://github.com/Chocobozzz/PeerTube/blob/develop/config/production.yaml.example#L110)

### Maintenance

 * Add GitPod support ([@jankeromnes](https://github.com/jankeromnes)) that could help people to contribute on PeerTube: https://github.com/Chocobozzz/PeerTube/blob/develop/.github/CONTRIBUTING.md#online-development
 * Add reminder to restart PeerTube in upgrade script ([@ldidry](https://github.com/ldidry))
 * Add argument to dockerfile to pass options to npm run build ([@NaPs](https://github.com/NaPs))
 * Add `NOCLIENT` env support to only install server dependencies. Example: `NOCLIENT=true yarn install --pure-lockfile` ([@rigelk](https://github.com/rigelk))

### Docker

 * **Important**: Add host network mode to the reverse proxy section (without this, it could break videos views and P2P: https://github.com/Chocobozzz/PeerTube/issues/1643#issuecomment-464789666)
 * **Important**: Add a network section to [docker-compose.yml template](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/docker-compose.yml)
and update your [.env](https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/.env#L8) to fix IP forwarding issue ([@Nutomic](https://github.com/nutomic))
 * Fix SMTP default configuration ([@Nutomic](https://github.com/nutomic))

### Features

 * Add video playlist support
   * A user has a default `Watch-later` playlist
   * A user can create private, unlisted or public playlists
   * An element in this playlist can start or stop at specific timestamps (you can create some kind of zapping for example)
   * The difference with a channel is that you cannot subscribe to a playlist, but you can add videos from any other user in your playlist.
   It's useful to organize your videos, or create a playlist of videos you like and share the link on the web etc
 * Add quarantine videos (auto blacklist videos on upload) feature :tada: ([@joshmorel](https://github.com/joshmorel))
 * Add Japanese & Nederlands & Português (Portugal) support
 * Add experimental HLS support
   * Better playback
   * Better bandwidth management (for both client & server)
   * Needs to store another video file per resolution, so enabling this option multiplies the videos storage by 2 (only new uploaded videos, this is not retroactive)
   * Requires ffmpeg >= 4
 * Better instance's followers management:
   * Add ability to remove an instance's follower
   * Add ability to forbid all new instance's followers
   * Add ability to manually approve new instance's followers
   * Add notification on new instance's follower
 * Improve UI:
   * Increase player default height
   * Reduce big play button border width
   * Increase thumbnail sizes
   * Add hover effect on video miniature
   * Add "my library" section in menu
   * Add missing icons in some buttons/dropdown
   * 2 rows per overview section
   * Increase video thumbnail blur ([@Zig-03](https://github.com/Zig-03))
   * Improve video miniatures list on mobile
   * Add animation when opening user notifications
 * Add ability for admins to disable the tracker (and so the P2P aspect of PeerTube, in order to improve users privacy for example)
 * Add original publication date attribute to videos, and add ability to filter on it (Andrés Maldonado)
 * Add video miniature dropdown
 * Add ability for admins to declare their instance as dedicated to NSFW content
 * Improve SEO (there is still work to be done)
 * Login is now case insensitive (if using official web client)
 * Add NSFW policy & users signup policy & auto blacklist strategy in features table in about page
 * Improve comment deletion warning
 * Restore videos list component on history back
 * Add ability to consult server logs in admin
 * Allow administrators to change/reset a user's password ([@rigelk](https://github.com/rigelk))
 * Add a debug page to help admins to fix IP configuration issues
 * Add ability for admins to limit users videos history size
 * Add ability for admins to delete old remote videos views (reduce database size)
 * Optimize video update page load
 * Less refresh jobs
 * Cleanup invalid AP rates/comments/shares
 * Better videos redundancy config error handling
 * Check emails are enabled if the admin requires email verification ([@joshmorel](https://github.com/joshmorel))
 * Add `Add /accounts/:username/ratings endpoint` ([@yohanboniface](https://github.com/yohanboniface))
 * Allow to control API rates limit from configuration ([@yohanboniface](https://github.com/yohanboniface))

### Bug fixes

 * Don't notify prior to scheduled update ([@joshmorel](https://github.com/joshmorel))
 * Fix account description database error
 * Fix Pleroma follow
 * Fix greek label
 * Fix email notification for some users
 * Fix translation of "Copy magnet URI"
 * Fix negative seconds by displaying 0 instead [@zacharystenger](https://github.com/zacharystenger)
 * Fix URL in video import notification
 * Don't close help popover when clicking on it
 * Fix `tmp` directory cleanup
 * Fix custom CSS help
 * Fix JSONLD context
 * Fix privacy label display in upload form
 * Fix my account settings responsiveness
 * Fix keyboard icon transparency ([@gbip](https://github.com/gbip))
 * Fix contact admin button overflow
 * Wait config to be loaded before loading login/signup
 * Privacy is optional in upload API endpoint
 * Fix hotkeys help popup overflow

***Since v1.3.0-rc.2***

### Bug fixes

 * Fix duplicates in playlist add component
 * Fix crash in files cache
 * Fix playlist view/update 403
 * Fix search with bad webfinger handles


## v1.2.1

### Bug fixes

 * **Important** Fix invalid `From` email header in contact form that could lead to the blacklisting of your SMTP server
 * Fix too long display name overflow in menu
 * Fix mention notification when a remote account mention a local account that has the same username than yours
 * Fix access to muted servers table for moderators
 * Don't crash notification popup on bug
 * Fix reset password script that leaks password on invalid value


## v1.2.0

### BREAKING CHANGES

 * **Docker:** `PEERTUBE_TRUST_PROXY` env variable is now an array ([LecygneNoir](https://github.com/LecygneNoir))
 * **Docker:** Check you have all the storage fields in your `/config/production.yaml` file: https://github.com/Chocobozzz/PeerTube/blob/develop/support/docker/production/config/production.yaml#L34
 * **nginx:** Add redundancy endpoint in static file. **You should add it in your nginx configuration: https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md#nginx**
 * **nginx:** Add socket io endpoint. **You should add it in your nginx configuration: https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md#nginx**
 * Moderators can manage users now (add/delete/update/block)
 * Add `tmp` and `redundancy` directories in configuration file. **You should configure them in your production.yaml**

### Maintenance

 * Check free storage before upgrading in upgrade script ([@Nutomic](https://github.com/nutomic))
 * Explain that PeerTube must be stopped in prune storage script
 * Add some security directives in the systemd unit configuration file ([@rigelk](https://github.com/rigelk) & [@mkoppmann](https://github.com/mkoppmann))
 * Update FreeBSD startup script ([@gegeweb](https://github.com/gegeweb))

### Docker

 * Patch docker entrypoint to speed up the chown at startup ([LecygneNoir](https://github.com/LecygneNoir))

### Features

 * Add Russian, Polish and Italian languages
 * Add user notifications:
   * Notification types:
     * Comment on my video
     * New video from my subscriptions
     * New video abuses (for moderators)
     * Blacklist/Unblacklist on my video
     * Video import finished (error or success)
     * Pending video published (after transcoding or a scheduled update)
     * My account or one of my channel has a new follower
     * Someone (except muted accounts) mentioned me in comments
     * A user registered on the instance (for moderators)
   * Notification actions:
     * Add a web notification
     * Send an english email
 * Add contact form in about page (**enabled by default**)
 * Add ability to unfederate a local video in blacklist modal (**checkbox checked by default**)
 * Support additional video extensions if transcoding is enabled (**enabled by default**)
 * Redirect to the last url on login
 * Add ability to automatically set the video caption in URL. Example: https://peertube2.cpy.re/videos/watch/9c9de5e8-0a1e-484a-b099-e80766180a6d?subtitle=ru
 * Automatically enable the last selected caption when watching a video
 * Add ability to disable, clear and list user videos history
 * Add a button to help to translate peertube
 * Add text in the report modal to explain to whom the report will be sent
 * Open my account menu entries on hover
 * Explain what features are enabled on the instance in the about page
 * Add an error message in the forgot password modal if the instance email system is not configured
 * Add sitemap
 * Add well known url to change password ([@rigelk](https://github.com/rigelk))
 * Remove 8GB video upload limit on client side. There may still be such limit depending on the reverse proxy configuration ([@scanlime](https://github.com/scanlime))
 * Add CSP ([@rigelk](https://github.com/rigelk) & [@Nutomic](https://github.com/nutomic))
 * Update title and description HTML tags when rendering video HTML page
 * Add webfinger support for remote follows ([@acid-chicken](https://github.com/acid-chicken))
 * Add tooltip to explain how the trending algorithm works ([@auberanger](https://github.com/auberanger))
 * Warn users when they want to delete a channel because they will not be able to create another channel with the same name
 * Warn users when they leave the video upload/update (on page refresh/tab close)
 * Set max user name, user display name, channel name and channel display name lengths to 50 characters ([@McFlat](https://github.com/mcflat))
 * Increase video abuse length to 3000 characters
 * Add totalLocalVideoFilesSize in the stats endpoint

### Bug fixes

 * Fix the addition of captions to a video
 * Fix federation of some videos
 * Fix NSFW blur on search
 * Add error message when trying to upload .ass subtitles
 * Fix default homepage in the progressive web application
 * Don't crash on queue error
 * Fix EXDEV errors if you have multiple mount points
 * Fix broken audio in transcoding with some videos
 * Fix crash on getVideoFileStream issue
 * Fix followers search
 * Remove trailing `/` in CLI import script ([@HesioZ](https://github.com/HesioZ/))
 * Use origin video url in canonical tag
 * Fix captions in HTTP fallback
 * Automatically refresh remote actors to fix deleted remote actors that are still displayed on some instances
 * Add missing translations in video embed page
 * Fix some styling issues in dark mode
 * Fix transcoding issues with some videos
 * Fix Mac OS mkv/avi upload
 * Fix menu overflow on mobile
 * Fix ownership button icons ([@joshmorel](https://github.com/joshmorel))


## v1.1.0

***Since v1.0.1***

### BREAKING CHANGES

 * **Docker:** `PEERTUBE_TRUST_PROXY` env variable is now an array ([LecygneNoir](https://github.com/LecygneNoir))

### Maintenance

 * Improve REST API documentation ([@rigelk](https://github.com/rigelk))
 * Add basic ActivityPub documentation ([@rigelk](https://github.com/rigelk))
 * Add CLI option to run PeerTube without client ([@rigelk](https://github.com/rigelk))
 * Add manpage to peertube CLI ([@rigelk](https://github.com/rigelk))
 * Make backups of files in optimize-old-videos script ([@Nutomic](https://github.com/nutomic))
 * Allow peertube-import-videos.ts CLI script to run concurrently ([@McFlat](https://github.com/mcflat))

### Scripts

 * Use DB information from config/production.yaml in upgrade script ([@ldidry](https://github.com/ldidry))
 * Add REPL script ([@McFlat](https://github.com/mcflat))

### Docker

 * Add search and import settings env settings env variables ([@kaiyou](https://github.com/kaiyou))
 * Add docker dev image ([@am97](https://github.com/am97))
 * Improve docker compose template ([@Nutomic](https://github.com/nutomic))
   * Add postfix image
   * Redirect HTTP -> HTTPS
   * Disable Træfik web UI

### Features

 * Automatically resume videos if the user is logged in
 * Hide automatically the menu when the window is resized ([@BO41](https://github.com/BO41))
 * Remove confirm modal for JavaScript/CSS injection ([@scanlime](https://github.com/scanlime))
 * Set bitrate limits for transcoding ([@Nutomic](https://github.com/nutomic))
 * Add moderation tools in the account page
 * Add bulk actions in users table (Delete/Ban for now)
 * Add search filter in admin users table
 * Add search filter in admin following
 * Add search filter in admin followers
 * Add ability to list all local videos
 * Add ability for users to mute an account or an instance
 * Add ability for administrators to mute an account or an instance
 * Rename "News" category to "News & Politics" ([@daker](https://github.com/daker))
 * Add explicit error message when changing video ownership ([@lucas-dclrcq](https://github.com/lucas-dclrcq))
 * Improve description of the HTTP video import feature ([@rigelk](https://github.com/rigelk))
 * Set shorter keyframe interval for transcoding (2 seconds) ([@Nutomic](https://github.com/nutomic))
 * Add ability to disable webtorrent (as a user) ([@rigelk](https://github.com/rigelk))
 * Make abuse-delete clearer ([@barbeque](https://github.com/barbeque))
 * Adding minimum signup age conforming to ceiling GPDR age ([@rigelk](https://github.com/rigelk))
 * Feature/description support fields length 1000 ([@McFlat](https://github.com/mcflat))
 * Add background effect to activated menu entry
 * Improve video upload error handling
 * Improve message visibility on signup
 * Auto login user on signup if email verification is disabled
 * Speed up PeerTube startup (in particular the first one)
 * Delete invalid or deleted remote videos
 * Add ability to admin to set email as verified ([@joshmorel](https://github.com/joshmorel))
 * Add separators in user moderation dropdown

### Bug fixes

 * AP mimeType -> mediaType
 * PeerTube is not in beta anymore
 * PeerTube is not in alpha anymore :p
 * Fix optimize old videos script
 * Check follow constraints when getting a video
 * Fix application-config initialization in CLI tools ([@Yetangitu](https://github.com/Yetangitu))
 * Fix video pixel format compatibility (using yuv420p) ([@rigelk](https://github.com/rigelk))
 * Fix video `state` AP context  ([tcitworld](https://github.com/tcitworld))
 * Fix Linked Signature compatibility
 * Fix AP collections pagination
 * Fix too big thumbnails (when using URL import)
 * Do not host remote AP objects: use redirection instead
 * Fix video miniature with a long name
 * Fix video views inconsistencies inside the federation
 * Fix video embed in Wordpress Gutenberg
 * Fix video channel videos url when scrolling
 * Fix player progress bar/seeking when changing resolution
 * Fix search tab title with no search
 * Fix YouTube video import with some videos

***Since v1.1.0-rc.1***

### Bug fixes

 * Fix AP infinite redirection
 * Fix trending page


## v1.0.1

### Security/Maintenance/Federation

 * Add HTTP Signature in addition to Linked Signature:
    * It's faster
    * Will allow us to use RSA Signature 2018 in the future without too much incompatibilities in the peertube federation


## v1.0.0

### SECURITY

 * Add more headers to HTTP signature to avoid actor impersonation by replaying modified signed HTTP requests (thanks Thibaut Girka)

### Bug fixes

 * Check video exists before extending expiration
 * Correctly delete redundancy files
 * Fix account URI in remote comment modal ([@rigelk](https://github.com/rigelk))
 * Fix avatar update
 * Avoid old issue regarding duplicated hosts in database


## v1.0.0-rc.2

### Bug fixes

 * Fix config endpoint


## v1.0.0-rc.1

### Features

 * Allow specification of channel ID in `peertube-upload.js` ([@anoadragon453](https://github.com/anoadragon453))
 * Show last commit hash alongside server version in footer ([@rigelk](https://github.com/rigelk))
 * Add comment feeds in watch page

### Bug fixes

 * Fix dnt route (yes again, but now we have unit tests for this route :D)
 * Check video channel name is unique when creating a new one
 * Fix video fps validator (prevent redundancy/refresh of some old videos)
 * Allow empty search on client side ([@rigelk](https://github.com/rigelk))
 * Correctly forward comment deletion


## v1.0.0-beta.16

### BREAKING CHANGES

 * Add prompt to upgrade.sh to install pre-release version ([@Nutomic](https://github.com/nutomic))

### Features

 * Add shortcuts icon in menu
 * Improve overview section titles
 * Check old password before change ([@BO41](https://github.com/BO41))
 * Adding frame-by-frame hotkey support in player ([@rigelk](https://github.com/rigelk))

### Bug fixes

 * Stop seeding torrents after a failed import
 * Fix player crashing the web browser
 * Fix player performance with small devices
 * Fix some untranslated strings
 * Fix video files duplicated when fps is null ([@rigelk](https://github.com/rigelk))
 * Fix video import of some youtube videos
 * Fix (long) video description when importing by url
 * Fix Mastodon federation with a comment reply
 * Correctly delete directories on import
 * Remove duplicated videos on unfollow/delete redundancy
 * Fix 404 on manifest
 * Hide useless error when destroying fake renderer
 * Display other videos on big screens on the right of the watch page
 * Fix no other videos displayed on some videos
 * Fix hidden advanced options in upload form
 * Fix message space on video upload cancel ([@rigelk](https://github.com/rigelk))
 * Fix error when updating many video captions
 * Fix "my account" subtitles
 * Fix error when clicking on the disabled publish button
 * Increase timeout on upload endpoint
 * Fix redundancy with videos already duplicated by another instance(s)
 * Correctly delete files on failed import


## v1.0.0-beta.15

### Features

 * Improve subscription button ([@rigelk](https://github.com/rigelk))
  * Display it for unlogged users
  * Add RSS feed
  * Allow remote follow
 * Allow remote comment ([@rigelk](https://github.com/rigelk))
 * Support Simplified Chinese ([@SerCom-KC](https://github.com/SerCom-KC))

### Bug fixes

 * Fix redundancy with old PeerTube torrents
 * Fix crash with `/static/dnt-policy/dnt-policy-1.0.txt` route
 * Fix redundancy totalVideos stats
 * Reduce video import TTL to 1 hour
 * Only duplicate public videos


## v1.0.0-beta.14

### Features

 * Video redundancy system (experimental)
 * Add peertube script (see [the doc](/support/doc/tools.md#cli-wrapper)) ([@rigelk](https://github.com/rigelk))
 * Improve download modal ([@rigelk](https://github.com/rigelk))
 * Add redirect after login ([@BO41](https://github.com/BO41))
 * Improve message when removing a user
 * Improve responsive on small screens
 * Improve performance:
   * Overview endpoint
   * SQL requests of watch page endpoints
   * SQL requests of ActivityPub endpoints
   * Cache user token
   * Videos infinite scroll in the web browser
 * Add warning if one of the storage directory is in the peertube production directory
 * Auto focus first field on login ([@rigelk](https://github.com/rigelk))
 * Add chevron hotkeys to change playback rate ([@rigelk](https://github.com/rigelk))

### Bug fixes

 * Fix 24 hours delay to process views
 * Fix tag search on overview page
 * Handle actors search beginning with '@'
 * Fix "no results" on overview page
 * Fix iOS player playback/subtitles menu
 * Fix description/comments that break the video watch page
 * Don't get recommended videos twice
 * Fix admin access to moderators
 * Fix nav tab and tag color in dark theme ([@rigelk](https://github.com/rigelk))
 * Fix help popover overflow ([@rigelk](https://github.com/rigelk))
 * Fix comment deletion with mastodon (only with new comments)


## v1.0.0-beta.13

### Features

 * Improve keyboard navigation ([@rigelk](https://github.com/rigelk))
 * Remember theme in local storage ([@rigelk](https://github.com/rigelk))

### Bug fixes

  * Fix upgrade/installation on node 8.12 (bcrypt issue)
  * Fix video channel deletion
  * Fix video channel RSS
  * Fix video views increment


## v1.0.0-beta.12

**If you have not updated to v1.0.0-beta.10, see the v1.0.0-beta.10.pre.1 changelog, in particular how to upgrade**

### BREAKING CHANGES

 * Users can now use the name they want for their channel.
 We will therefore favour the display of video channel handles/names instead of account in the future.

### Documentation

 * Add SECURITY.md document
 * Add TCP/IP tuning template to prevent buffer bloat/latency ([@scanlime](https://github.com/scanlime))
 * Add `parse-log` admin tool documentation
 * Improve README schemas ([@Edznux](https://github.com/edznux))

### nginx template

 * Add gzip support ([@scanlime](https://github.com/scanlime))

### Docker template

 * Add quota to the docker configuration values ([@kaiyou](https://github.com/kaiyou))

### Features

 * Add portuguese and swedish languages
 * Support user subscriptions
 * Add ability to search videos or channels with their URL/handle (can be opt-out by the admin)
 * Add "videos overview" page (pick randomly some categories/tags/channels and display their videos)
 * Add ability to set a name (left part of the handle) to a channel instead of UUID
 * Users can "give" their videos to other local users (WIP, feedback welcome) ([@grizio](https://github.com/grizio))
 * Add keyboard shortcuts (press `?` to see them) ([@rigelk](https://github.com/rigelk))
 * Add ability to set daily video upload quota to users ([@Nutomic](https://github.com/nutomic))
 * Add user email verification (can be opt-in by the admin) ([@joshmorel](https://github.com/joshmorel))
 * Improve video watch page style ([@rigelk](https://github.com/rigelk))
 * Trending page takes into account views from the last x days (defined by the admin in the configuration file)
 * Add "start at" checkbox in the video share modal
 * Add instance capabilities table in the signup page ([@rigelk](https://github.com/rigelk))
 * Improve video abuses display in admin ([@Nutomic](https://github.com/nutomic))
 * Add "my videos" shortcut in menu ([@LeoMouyna](https://github.com/LeoMouyna))
 * Support 0.75 and 1.25 playback speeds ([@Glandos](https://github.com/Glandos))
 * Improve error message on actor name conflict
 * Improve videos list/search SQL query (split it into 2 queries)
 * Make left menu show the scrollbar only on hover/focus ([@rigelk](https://github.com/rigelk))
 * Other videos column in watch page show related tagged videos if possible ([@jorropo](https://github.com/jorropo))
 * Password change errors more friendly ([@jorropo](https://github.com/jorropo))
 * Improve labels for video privacies (video upload/update)
 * Add theming via CSS custom properties ([@rigelk](https://github.com/rigelk))
 * Add dark theme ([@rigelk](https://github.com/rigelk))
 * Add input color to cope with browser themes ([@rigelk](https://github.com/rigelk))

### Bug fixes

 * Fix player video playback (videos never ends or infinite load after seeking)
 * Fix video URL import with videos having a small title
 * Make HSTS opt-in and leave it to the reverse-proxy ([@rigelk](https://github.com/rigelk))
 * Fix search results on mobile
 * Do not import live streaming
 * Fix NSFW filter when the instance decides to hide them and the user decides to list them
 * Delete highlighted comment too if needed
 * Fix ffmpeg auto thread admin configuration ([@jorropo](https://github.com/jorropo))
 * ActivityPub: use height instead of width to represent the video resolution
 * Fix thumbnail/preview in upload.js script
 * Fix import-videos.js duplicate detection
 * Fix occitan language label


## v1.0.0-beta.11

**If you have not updated to v1.0.0-beta.10, see the v1.0.0-beta.10.pre.1 changelog, in particular how to upgrade**

### Features

 * Add ability to import videos from a URL (YouTube, Dailymotion, Vimeo, raw file etc) or torrent file/magnet.
 Should be explicitly enabled by the administrator in the configuration file
 * Add german, spanish, taiwan (traditional chinese) and occitan languages
 * Add ability to delete our account
 * Add ability to ban a user
 * Add ability to set a moderation comment to an abuse
 * Add state (pending, accepted, rejected) attribute to an abuse
 * Add ability to set a reason when blacklisting a video
 * Add ability to blacklist local videos
 * Improve abuse and blacklist tables
 * Add user quota used in users list
 * Tracker only accept known infohash (avoid people to use your tracker for files unrelated to PeerTube)
 * Add database pool configuration ([@rigelk](https://github.com/rigelk))
 * Add audit log ([@Nautigsam](https://github.com/Nautigsam))
 * Add ffmpeg nice and auto thread ([@jorropo](https://github.com/jorropo))
 * Upgrade to bootstrap 4
 * DNT support

### Bug fixes

 * Fix videos FPS federation
 * Cleanup request files on bad request
 * Handle truncated markdown links
 * Fix dropdown position in menu
 * Translate subtitle languages in player
 * Translate player according the language of the interface
 * Fix reset my password button ([@joshmorel](https://github.com/joshmorel))


## v1.0.0-beta.10

**See the v1.0.0-beta.10.pre.1 changelog, in particular how to upgrade**

### Bug fixes (from beta.10.pre.3)

 * Fix caption upload on Mac OS


## v1.0.0-beta.10.pre.3

**See the v1.0.0-beta.10.pre.1 changelog, in particular how to upgrade**

### Bug fixes (from beta.10.pre.2)

 * Try to fix the infinite creation of Delete actor jobs by deleting kue migration
 * Cleanup SQL indexes
 * Try to optimize SQL search query
 * Try to optimize videos list SQL query
 * Add more logs and fix logger when having an error
 * Move subscription helper in the account line in video watch page
 * Fix responsive on videos search
 * Refresh orphan actors
 * Don't send a follow request if the follow was already accepted


## v1.0.0-beta.10.pre.2

**See the v1.0.0-beta.10.pre.1 changelog, in particular how to upgrade**

### Bug fixes (from beta.10.pre.1)

 * Fix captions/subtitles freeze in player
 * Fix attribute label width in video watch page
 * Fix player playback in Chrome
 * Revert SQL optimization when listing videos: it breaks the connection pool of some instances


## v1.0.0-beta.10.pre.1

This version is a pre release because it contains many important changes, and requires manual steps before upgrading.

**Important:** Before upgrading run the following commands (no need to stop PeerTube) on your PeerTube database (in this example it's *peertube_prod*):

```
$ sudo -u postgres psql peertube_prod -c 'CREATE EXTENSION IF NOT EXISTS unaccent;'
$ sudo -u postgres psql peertube_prod -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
```

You will need [PostgreSQL Contrib](https://www.postgresql.org/docs/9.6/static/contrib.html).

### BREAKING CHANGES

 * Require `unaccent` and `pg_trgm` PostgreSQL extension for the PeerTube database
 * `category` filter param is replaced by `categoryOneOf`
 * Switch job queue to [Bull](https://github.com/OptimalBits/bull). **PeerTube will not migrate your old pending jobs in this new queue manager**
 * Update nginx template (you need to [update manually](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/production.md#nginx))
 * Update default cache size configurations
 * Update search API route: `/videos/search` becomes `/search/videos`
 * Needs Redis >= 2.8.18

### Features

 * Add ability to change the language of the interface (currently available: english, french, basque, catalan, czech and esperanto)
 * Subtitles/captions support (.srt and .vtt)
 * Add advanced search
 * Add ability to click on category/language/licence/tags in watch page
 * Improve explanations of P2P & Privacy section in about page
 * Avoid design latency when the admin set custom CSS
 * Add ability to update video channel avatar
 * Limit video resolution depending on the video element size (Nitesh Sawant)
 * Show "Other videos" on a <1300px viewport ([@Simounet](https://github.com/simounet))
 * Add QR code to share videos URL ([@DeeJayBro](https://github.com/DeeJayBro))
 * Add "agree to the terms" checkbox in registration form
 * Add tracker rate limiter
 * Add author URL in OEmbed response
 * Display username instead of email in menu
 * Clarifying what extensions are accepted for upload ([@rigelk](https://github.com/rigelk))
 * Thumbnail support for RSS feeds ([@rigelk](https://github.com/rigelk))
 * Open CORS on API and static resources ([@rezonant](https://github.com/rezonant)
 * B-adapt 1 and B-frames 16 on ffmpeg transcoding:  ([@Anton-Latukha](https://github.com/Anton-Latukha)). See https://github.com/Chocobozzz/PeerTube/pull/774 for more information
 * Support Redis socket ([@rigelk](https://github.com/rigelk))
 * Improve video `start` param to support string times (for example: 2m42s))
 * Display table next/prev/first/last icons in admin tables
 * NodeInfo support ([@rigelk](https://github.com/rigelk))
 * Improve HTTP headers security ([@rigelk](https://github.com/rigelk))
 * Improve client accessibility (for screen reader users etc)
 * Optimize SQL requests (in particular the one to list videos)
 * Optimize images ([@jorropo](https://github.com/jorropo))
 * Add esperanto, lojban, klingon and kotava (audio/subtitle) languages
 * Allow uploads of videos <8GB (*experimental*)
 * Handle FPS > 30 (*experimental*)

### Bug fixes

 * Fix avatars/thumbnails update (cache issue)
 * Fix pagination on admin job table when changing the job state
 * Fix SQL transaction retryer log
 * Correctly handle error when remote instance is down
 * Fix account videos URL when scrolling
 * Avoid commenting twice by disabling comment submit button when sending the comment
 * Reset confirm component input when closing it
 * Fix video speed when video resolutions changes ([@grizio](https://github.com/grizio))
 * Disable hotkeys modifiers for numbers ([@rigelk](https://github.com/rigelk))
 * Reset published date on video publish (scheduled or after a transcoding)
 * Avoid 404 title on the first page load
 * Fix forgot password message regarding email
 * Remove scroll to top when closing the menu ([@ebrehault](https://github.com/ebrehault))
 * Use UUID for channel link in watch page

### Docker

 * Add PEERTUBE_SMTP_DISABLE_STARTTLS config env


## v1.0.0-beta.9

### Features

 * Theater/Cinema mode in player
 * Add ability to wait transcoding before publishing it
 * Add ability for uploaders to schedule video update
 * Add time display to see where we seek the video
 * Add title in player peers info to show total downloaded/uploaded data
 * Provide magnet URI in player and download modal ([@rigelk](https://github.com/rigelk))
 * Add warning if the domain name is different from the one of the first start of Peertube
 * Add resolution to create-transcoding-job script ([@fflorent](https://github.com/fflorent))

### Bug fixes

 * Fix dislikes number in video watch page
 * Fix import when the imported file has the same extension than an already existing file
 * Fix bad RSS descriptions when filtering videos by account or channel
 * Fix RSS results limit
 * Fix glitch when updating player volume
 * Use local object URLs for feeds
 * Automatically jump to the highlighted thread
 * Fix account link width on video view ([@sesn](https://github.com/sesn))
 * Prevent commenting twice
 * Blue links color in comments
 * Fix quota precision in users list
 * Handle markdown in account/video channel pages
 * Fix avatar image in channel page
 * Fix slow HTTP fallback on Firefox
 * Do not create a user with the same username than another actor name
 * Reset search on page change
 * Fix images size limit
 * Log torrent errors/warnings in the console, instead of disturbing users


## v1.0.0-beta.8

### Features

 * Docker:
   * Add disable_starttls and transcoding configuration variables
   * `.env` file to define env variables (instead of defining them in `docker-compose.yml`)
   * Some improvements that should make the upgrades less painful
 * Add ability to manually run transcoding jobs (admin with CLI)
 * Add ability to import a video file (admin with CLI)
 * Add context menu to the player
 * Add number of videos published by an account/video channel
 * Improve player progress bar
 * Improve Twitter configuration help tooltips
 * Pick average video file instead of max quality in "Auto" resolution mode
 * Increase access token lifetime to 1 day
 * Add video comments RSS

### Bug fixes

 * Clicking on "Download" correctly opens a popup to download the video
 (instead of opening the video in a new tab)
 * Fix frequent logout
 * Fix `publishedAt` video attribute when following a new instance
 * Correctly resumes the video on "PeerTube" link click in embed
 * Fix markdown links truncation
 * Fix account/channel pages not updated if we only change the account/channel
 * Fix player resolution change that plays even if the video was paused
 * Fix posting view in embed that contains search params
 * Fix video watch tooltips regarding subscriptions by using the account name
 instead of the display name
 * Rename "my settings" to "my account" in menu


## v1.0.0-beta.7

### BREAKING CHANGES

 * Account client URLs are now `/accounts/{username}/` (and not `/accounts/{id}/`)

### Documentation

 * Better documentation on how to deploy with Docker: https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/docker.md

### Features

 * Add short description in about page
 * Add owner account name in video channel page
 * Improve performance in ActivityPub controllers
 * Video **support** field inherits video channel **support** field when uploading/updating a video
 * Resume video when clicking on "PeerTube" link in embed

### Bug fixes

 * Fix player on Android
 * Fix player when Firefox has cookies disabled
 * Reload "my videos" after a delete
 * Fix missing key configuration when upgrading with Docker
 * Fix CC audience in Activity Pub objects/activities


## v1.0.0-beta.6

### Features

 * Handle concurrent requests in cache middleware
 * Add ability to enable registration by IP

### Bug fixes

 * Fix insane SQL request when loading all video attributes


## v1.0.0-beta.5

### BREAKING CHANGES

 * Update Docker Compose (https://github.com/Chocobozzz/PeerTube/commit/fd5e57bbe2accbdb16b6aa65337c5ef44b5bd8fb)
 * Rename client routes:
   * `/admin/users/add` to `/admin/users/create`
   * `/videos/edit/:uuid` to `/videos/update/:uuid`
   * `/admin/users/:id/update` to `/admin/users/update/:id`


### Features

 * Adding basic helpers to guide users for comments/subscribe to accounts
 * Add ability to move a video in another channel
 * Improve web browser RAM consumption when watching (long) videos
 * Support robots.txt in configuration
 * Add ability to select the Redis database in configuration


### Bug fixes

 * Fix error message on token expiration
 * Increase menu icon size
 * Add timeout and TTL to request jobs to fix stuck job
 * Fix responsive account about page
 * Fix updating description account
 * Account/video channel descriptions are not required anymore
 * Fix video channel description and support max length (500 characters now)
 * Fix "..." for buttons (delete/edit) in admin tables
 * Fix overflow in markdown textarea preview
 * Add ability to embed videos in a Twitter card
 * Use `publishedAt` attribute when sorting videos
 * Fix concurrent requests in videos list
 * Fix player on iOS


## v1.0.0-beta.4

### BREAKING CHANGES

 * Hide by default NSFW videos. Update the `instance.default_nsfw_policy` configuration to `blur` to keep the old behaviour
 * Move video channels routes:
   * `/videos/channels` routes to `/video-channels`
   * `/videos/accounts/{accountId}/channels` route to `/accounts/{accountId}/video-channels`
 * PeerTube now listen on 127.0.0.1 by default
 * Use ISO 639 for language (*en*, *es*, *fr*...)
   * Tools (`import-videos`...) need the language ISO639 code instead of a number
   * API (`upload`, `update`, `list`...) need/return the language ISO639 code instead of a number

### Features

 * Add `publishedAt` attribute to videos
 * Improve player:
   * Smooth progress bar
   * Settings menu
   * Automatic resolution (depending on the user bandwidth)
   * Some animations/effects
   * More reactive when clicking on play
   * Handle autoplay blocking by some web browsers
   * Better responsive
   * Add ability to link a specific timestamp. Example: https://peertube2.cpy.re/videos/watch/f78a97f8-a142-4ce1-a5bd-154bf9386504?start=58
 * Add an id to the body to override current CSS (for custom CSS)
 * Add privacy argument to `upload.ts` script
 * RSS/Atom/JSON-feed for videos recently-added/trending/account
 * Support hostname binding in the configuration
 * Add ability to click on an account in the video watch page (link to a search)
 * Better responsive on many comment replies
 * Move follows in the job queue
 * Add ability to choose the NSFW videos policy: hide, blur or display. Could be overrode by the user
 * Add video privacy information in *my videos page*
 * Use the video name for the torrent file name instead of the UUID
 * Handle errors in embed (video not found, server error...)
 * Account view (videos uploaded by this account + video channel owned by this account + about pages)
 * Video channel view (videos uploaded in this channel + about pages)
 * Video channel management (avatar update is still missing)

### Bug fixes

 * Fix "show more" description on video change
 * Accept unlisted comments
 * Don't start application until all components were initialized
 * Fix word-break in video description and video comments
 * Don't add a `.` after the URL in the "forgot password" email



## v1.0.0-beta.3

### Features

 * Add hover background color in menu
 * Add info about the initial user quota in the registration form
 * Add link to register in the login form
 * Prevent brute force login attack

### Bug fixes

 * Fix bad federation with videos with special utf characters in description (again)
 * Fix views system behind a reverse proxy


## v1.0.0-beta.2

### Features

 * More logging in SMTP module
 * Add option to disable starttls in SMTP module
 * Update STUN servers (using framasoft.org and stunprotocol.org now)
 * Min comment length is 1 now (useful for emoji...)
 * Better embed video player in small screens
 * Reduce display time of title/description/control bar in embed on inactivity
 * Add sign languages for videos attribute
 * Add autoplay parameter for embed
 * Videos search on account username and host too
 * Redirect to homepage on empty search

### Bug fixes

 * Fix mentions in comment replies
 * Logo/Title redirects to the default route
 * Fix bad federation with videos with special utf characters in description
 * Fix pagination on mobile
 * Use instance name for page titles
 * Fix bad id for Create activities (ActivityPub)
 * Handle inner actors instead of just handling actor ids (ActivityPub)
 * Fallback to torrent file if infohash is incorrect
 * Fix admin config errors display/validation
 * Add public to Announces (ActivityPub)
 * Fix inability to run client when cookies are disabled
 * Fix words breaking in videos description
 * Graceful exit when import videos script fails
 * Fix import videos with long names
 * Fix login with a password containing special characters
 * Fix player error flickering with an unsupported video format
 * Fix comment delete federation
 * Fix communication of a PeerTube instance and Mastodon
 * Fix custom configuration with number values


## v1.0.0-beta.1

Nothing new here, but PeerTube is stable enough for being in beta now.


## v1.0.0-alpha.9

### BREAKING CHANGES

 * Update videos list/search/get API response:
   * Removed `resolution` field
   * Removed `resolutionLabel` field
   * Removed `category` field
   * Removed `categoryLabel` field
   * Removed `licence` field
   * Removed `licenceLabel` field
   * Removed `language` field
   * Removed `languageLabel` field
   * Removed `privacy` field
   * Removed `privacyLabel` field
   * Added `resolution.id` field
   * Added `resolution.label` field
   * Added `category.id` field
   * Added `category.label` field
   * Added `licence.id` field
   * Added `licence.label` field
   * Added `language.id` field
   * Added `language.label` field
   * Added `privacy.id` field
   * Added `privacy.label` field

### Bug fixes

 * Fix video_share_url duplicate key on failed transcoding job


## v1.0.0-alpha.8

### Features

 * Add ability to set a short instance description


## v1.0.0-alpha.7

### BREAKING CHANGES

 * Update videos list/search API response:
   * Removed `accountName` field
   * Removed `serverHost` field
   * Added `account.name` field
   * Added `account.displayName` field
   * Added `account.host` field
   * Added `account.url` field
   * Added `account.avatar` field
 * Update video abuses API response:
   * Removed `reporterUsername` field
   * Removed `reporterServerHost` field
   * Removed `videoId` field
   * Removed `videoUUID` field
   * Removed `videoName` field
   * Added `reporterAccount` field
   * Added `video.id` field
   * Added `video.name` field
   * Added `video.uuid` field
   * Added `video.url` field

### Features

 * Add "Local" in menu that lists only local videos


## v1.0.0-alpha.4

### Features

 * Add iOS support


## v1.0.0-alpha.1

### Features

 * Add messages about privacy and P2P
 * Add stats route
 * Add playback setting


## v0.0.29-alpha

### BREAKING CHANGES

 * Use only 1 thread for transcoding by default

### Features

 * Add help to JS/CSS custom configuration inputs
 * Keep ratio in video thumbnail generation
 * Handle video in portrait mode

### Bug fixes

 * Fix complete description on some videos
 * Fix job sorting in administration


## v0.0.28-alpha

### BREAKING CHANGES

 * Enable original file transcoding by default in configuration
 * Disable transcoding in other definitions in configuration

### Features

 * Fallback to HTTP if video cannot be loaded
 * Limit to 30 FPS in transcoding


## v0.0.27-alpha

### Features

 * Add ability for admin to inject custom JavaScript/CSS
 * Add help tooltip on some fields

### Bug fixes

 * Fix comment reply highlighting


## v0.0.26-alpha

### BREAKING CHANGES

 * Renamed script `import-youtube.js` to `import-videos.js`
 * Renamed `import-video.js` argument `youtube-url` to `target-url`

### Features

 * Add "Support" attribute/button on videos
 * Add ability to import from all [supported sites](https://rg3.github.io/youtube-dl/supportedsites.html) of youtube-dl

### Bug fixes

 * Fix custom instance name overflow


## v0.0.25-alpha

### Features

 * Add ability to link a specific comment

### Bug fixes

 * Fix avatars on video watch page


## v0.0.24-alpha

### Features

* Publish comments with *ctrl + enter*

### Bug fixes

* Don't stuck on active jobs
* Fix deleting a video with comments
* Fix infinite scroll (videos list)
