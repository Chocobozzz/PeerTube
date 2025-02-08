// Data from API hooks: {hookType}:api.{location}.{elementType}.{actionType}.{target}
// Data in internal functions: {hookType}:{location}.{elementType}.{actionType}.{target}

export const clientFilterHookObject = {
  // Filter params/result of the function that fetch videos of the trending page
  'filter:api.trending-videos.videos.list.params': true,
  'filter:api.trending-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the trending page
  'filter:api.most-liked-videos.videos.list.params': true,
  'filter:api.most-liked-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the local page
  'filter:api.local-videos.videos.list.params': true,
  'filter:api.local-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the recently-added page
  'filter:api.recently-added-videos.videos.list.params': true,
  'filter:api.recently-added-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the browse videos page
  'filter:api.browse-videos.videos.list.params': true,
  'filter:api.browse-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the user subscription page
  'filter:api.user-subscriptions-videos.videos.list.params': true,
  'filter:api.user-subscriptions-videos.videos.list.result': true,

  // Filter params/result of the function that fetch the video of the video-watch page
  'filter:api.video-watch.video.get.params': true,
  'filter:api.video-watch.video.get.result': true,

  // Filter params/result of the function that fetch video playlist elements of the video-watch page
  'filter:api.video-watch.video-playlist-elements.get.params': true,
  'filter:api.video-watch.video-playlist-elements.get.result': true,

  // Filter params/result of the function that fetch the threads of the video-watch page
  'filter:api.video-watch.video-threads.list.params': true,
  'filter:api.video-watch.video-threads.list.result': true,

  // Filter params/result of the function that fetch the replies of a thread in the video-watch page
  'filter:api.video-watch.video-thread-replies.list.params': true,
  'filter:api.video-watch.video-thread-replies.list.result': true,

  // Filter params/result of the function that fetch videos according to the user search
  'filter:api.search.videos.list.params': true,
  'filter:api.search.videos.list.result': true,
  // Filter params/result of the function that fetch video channels according to the user search
  'filter:api.search.video-channels.list.params': true,
  'filter:api.search.video-channels.list.result': true,
  // Filter params/result of the function that fetch video playlists according to the user search
  'filter:api.search.video-playlists.list.params': true,
  'filter:api.search.video-playlists.list.result': true,

  // Filter form
  'filter:api.signup.registration.create.params': true,

  // Filter params/result of the function that fetch video playlist elements of the my-library page
  'filter:api.my-library.video-playlist-elements.list.params': true,
  'filter:api.my-library.video-playlist-elements.list.result': true,

  // Filter the options to create our player
  'filter:internal.video-watch.player.build-options.params': true,
  'filter:internal.video-watch.player.build-options.result': true,

  // Filter the options to load a new video in our player
  'filter:internal.video-watch.player.load-options.params': true,
  'filter:internal.video-watch.player.load-options.result': true,

  // Filter our SVG icons content
  'filter:internal.common.svg-icons.get-content.params': true,
  'filter:internal.common.svg-icons.get-content.result': true,

  // Filter left menu links
  'filter:left-menu.links.create.result': true,

  // Filter upload page alert messages
  'filter:upload.messages.create.result': true,

  'filter:login.instance-about-plugin-panels.create.result': true,
  'filter:signup.instance-about-plugin-panels.create.result': true,

  'filter:share.video-embed-code.build.params': true,
  'filter:share.video-embed-code.build.result': true,
  'filter:share.video-playlist-embed-code.build.params': true,
  'filter:share.video-playlist-embed-code.build.result': true,

  'filter:share.video-embed-url.build.params': true,
  'filter:share.video-embed-url.build.result': true,
  'filter:share.video-playlist-embed-url.build.params': true,
  'filter:share.video-playlist-embed-url.build.result': true,

  'filter:share.video-url.build.params': true,
  'filter:share.video-url.build.result': true,
  'filter:share.video-playlist-url.build.params': true,
  'filter:share.video-playlist-url.build.result': true,

  'filter:video-watch.video-plugin-metadata.result': true,

  // Filter videojs options built for PeerTube player
  'filter:internal.player.videojs.options.result': true,

  // Filter p2p media loader options built for PeerTube player
  'filter:internal.player.p2p-media-loader.options.result': true,

  // Filter bulk actions in user list
  'filter:admin-users-list.bulk-actions.create.result': true,

  // Filter actions in comment list
  'filter:admin-video-comments-list.actions.create.result': true,

  // Filter bulk actions in comment list
  'filter:admin-video-comments-list.bulk-actions.create.result': true,

  // Filter user moderation actions
  'filter:user-moderation.actions.create.result': true,

  // Filter actions in abuse list
  'filter:admin-abuse-list.actions.create.result': true
}

export type ClientFilterHookName = keyof typeof clientFilterHookObject

export const clientActionHookObject = {
  // Fired when the application is being initialized
  'action:application.init': true,

  // Fired when the video watch page is being initialized
  'action:video-watch.init': true,
  // Fired when the video watch page loaded the video
  'action:video-watch.video.loaded': true,
  // Fired when the player finished loading
  'action:video-watch.player.loaded': true,
  // Fired when the video watch page comments(threads) are loaded and load more comments on scroll
  'action:video-watch.video-threads.loaded': true,
  // Fired when a user click on 'View x replies' and they're loaded
  'action:video-watch.video-thread-replies.loaded': true,

  // Fired when the video channel creation page is being initialized
  'action:video-channel-create.init': true,

  // Fired when the video channel update page is being initialized
  'action:video-channel-update.init': true,
  'action:video-channel-update.video-channel.loaded': true,

  // Fired when the page that list video channel videos is being initialized
  'action:video-channel-videos.init': true,
  'action:video-channel-videos.video-channel.loaded': true,
  'action:video-channel-videos.videos.loaded': true,

  // Fired when the page that list video channel playlists is being initialized
  'action:video-channel-playlists.init': true,
  'action:video-channel-playlists.video-channel.loaded': true,
  'action:video-channel-playlists.playlists.loaded': true,

  // Fired when the video edit page (upload, URL/torrent import, update) is being initialized
  // Contains a `type` and `updateForm` object attributes
  'action:video-edit.init': true,

  // Fired when values of the video edit form changed
  'action:video-edit.form.updated': true,

  // Fired when the login page is being initialized
  'action:login.init': true,

  // Fired when the search page is being initialized
  'action:search.init': true,

  // Fired every time Angular URL changes
  'action:router.navigation-end': true,

  // Fired when the registration page is being initialized
  'action:signup.register.init': true,

  // PeerTube >= 3.2
  // Fired when the admin plugin settings page is being initialized
  'action:admin-plugin-settings.init': true,

  // Fired when the video upload page is being initialized
  'action:video-upload.init': true,
  // Fired when the video import by URL page is being initialized
  'action:video-url-import.init': true,
  // Fired when the video import by torrent/magnet URI page is being initialized
  'action:video-torrent-import.init': true,
  // Fired when the "Go Live" page is being initialized
  'action:go-live.init': true,

  // Fired when the user explicitly logged in/logged out
  'action:auth-user.logged-in': true,
  'action:auth-user.logged-out': true,
  // Fired when the application loaded user information (using tokens from the local storage or after a successful login)
  'action:auth-user.information-loaded': true,

  // Fired when the modal to download a video/caption is shown
  'action:modal.video-download.shown': true,
  // Fired when the modal to share a video/playlist is shown
  'action:modal.share.shown': true,

  // ####### Embed hooks #######
  // /!\ In embed scope, peertube helpers are not available
  // ###########################

  // Fired when the embed loaded the player
  'action:embed.player.loaded': true
}

export type ClientActionHookName = keyof typeof clientActionHookObject

export const clientHookObject = Object.assign({}, clientFilterHookObject, clientActionHookObject)
export type ClientHookName = keyof typeof clientHookObject

export interface ClientHook {
  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T>
}
