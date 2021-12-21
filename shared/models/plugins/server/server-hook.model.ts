// {hookType}:{api?}.{location}.{subLocation?}.{actionType}.{target}

export const serverFilterHookObject = {
  // Filter params/result used to list videos for the REST API
  // (used by the trending page, recently-added page, local page etc)
  'filter:api.videos.list.params': true,
  'filter:api.videos.list.result': true,

  // Filter params/result used to list account videos for the REST API
  'filter:api.accounts.videos.list.params': true,
  'filter:api.accounts.videos.list.result': true,

  // Filter params/result used to list channel videos for the REST API
  'filter:api.video-channels.videos.list.params': true,
  'filter:api.video-channels.videos.list.result': true,

  // Filter params/result used to list my user videos for the REST API
  'filter:api.user.me.videos.list.params': true,
  'filter:api.user.me.videos.list.result': true,

  // Filter params/result used to list overview videos for the REST API
  'filter:api.overviews.videos.list.params': true,
  'filter:api.overviews.videos.list.result': true,

  // Filter params/results to search videos/channels in the DB or on the remote index
  'filter:api.search.videos.local.list.params': true,
  'filter:api.search.videos.local.list.result': true,
  'filter:api.search.videos.index.list.params': true,
  'filter:api.search.videos.index.list.result': true,
  'filter:api.search.video-channels.local.list.params': true,
  'filter:api.search.video-channels.local.list.result': true,
  'filter:api.search.video-channels.index.list.params': true,
  'filter:api.search.video-channels.index.list.result': true,
  'filter:api.search.video-playlists.local.list.params': true,
  'filter:api.search.video-playlists.local.list.result': true,
  'filter:api.search.video-playlists.index.list.params': true,
  'filter:api.search.video-playlists.index.list.result': true,

  // Filter the result of the get function
  // Used to get detailed video information (video watch page for example)
  'filter:api.video.get.result': true,

  // Filter the result of the accept upload/live, import via torrent/url functions
  // If this function returns false then the upload is aborted with an error
  'filter:api.video.upload.accept.result': true,
  'filter:api.live-video.create.accept.result': true,
  'filter:api.video.pre-import-url.accept.result': true,
  'filter:api.video.pre-import-torrent.accept.result': true,
  'filter:api.video.post-import-url.accept.result': true,
  'filter:api.video.post-import-torrent.accept.result': true,
  // Filter the result of the accept comment (thread or reply) functions
  // If the functions return false then the user cannot post its comment
  'filter:api.video-thread.create.accept.result': true,
  'filter:api.video-comment-reply.create.accept.result': true,

  // Filter attributes when creating video object
  'filter:api.video.upload.video-attribute.result': true,
  'filter:api.video.import-url.video-attribute.result': true,
  'filter:api.video.import-torrent.video-attribute.result': true,
  'filter:api.video.live.video-attribute.result': true,

  // Filter params/result used to list threads of a specific video
  // (used by the video watch page)
  'filter:api.video-threads.list.params': true,
  'filter:api.video-threads.list.result': true,

  // Filter params/result used to list replies of a specific thread
  // (used by the video watch page when we click on the "View replies" button)
  'filter:api.video-thread-comments.list.params': true,
  'filter:api.video-thread-comments.list.result': true,

  // Filter get stats result
  'filter:api.server.stats.get.result': true,

  // Filter result used to check if we need to auto blacklist a video
  // (fired when a local or remote video is created or updated)
  'filter:video.auto-blacklist.result': true,

  // Filter result used to check if a user can register on the instance
  'filter:api.user.signup.allowed.result': true,

  // Filter result used to check if video/torrent download is allowed
  'filter:api.download.video.allowed.result': true,
  'filter:api.download.torrent.allowed.result': true,

  // Filter result to check if the embed is allowed for a particular request
  'filter:html.embed.video.allowed.result': true,
  'filter:html.embed.video-playlist.allowed.result': true
}

export type ServerFilterHookName = keyof typeof serverFilterHookObject

export const serverActionHookObject = {
  // Fired when the application has been loaded and is listening HTTP requests
  'action:application.listening': true,

  // API actions hooks give access to the original express `req` and `res` parameters

  // Fired when a local video is updated
  'action:api.video.updated': true,
  // Fired when a local video is deleted
  'action:api.video.deleted': true,
  // Fired when a local video is uploaded
  'action:api.video.uploaded': true,
  // Fired when a local video is viewed
  'action:api.video.viewed': true,

  // Fired when a live video is created
  'action:api.live-video.created': true,

  // Fired when a thread is created
  'action:api.video-thread.created': true,
  // Fired when a reply to a thread is created
  'action:api.video-comment-reply.created': true,
  // Fired when a comment (thread or reply) is deleted
  'action:api.video-comment.deleted': true,

  // Fired when a caption is created
  'action:api.video-caption.created': true,
  // Fired when a caption is deleted
  'action:api.video-caption.deleted': true,

  // Fired when a user is blocked (banned)
  'action:api.user.blocked': true,
  // Fired when a user is unblocked (unbanned)
  'action:api.user.unblocked': true,
  // Fired when a user registered on the instance
  'action:api.user.registered': true,
  // Fired when an admin/moderator created a user
  'action:api.user.created': true,
  // Fired when a user is removed by an admin/moderator
  'action:api.user.deleted': true,
  // Fired when a user is updated by an admin/moderator
  'action:api.user.updated': true,

  // Fired when a user got a new oauth2 token
  'action:api.user.oauth2-got-token': true,

  // Fired when a video is added to a playlist
  'action:api.video-playlist-element.created': true
}

export type ServerActionHookName = keyof typeof serverActionHookObject

export const serverHookObject = Object.assign({}, serverFilterHookObject, serverActionHookObject)
export type ServerHookName = keyof typeof serverHookObject

export interface ServerHook {
  runHook <T> (hookName: ServerHookName, result?: T, params?: any): Promise<T>
}
