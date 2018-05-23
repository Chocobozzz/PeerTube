# Changelog

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
