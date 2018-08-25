# Changelog

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
