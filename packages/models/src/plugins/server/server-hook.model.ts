// {hookType}:{root}.{location}.{subLocation?}.{actionType}.{target}

export const serverFilterHookObject = {
  // Filter params/result used to list videos for the REST API
  // (used by the trending page, recently-added page, local page etc)
  'filter:api.videos.list.params': true,
  'filter:api.videos.list.result': true,

  // Filter params/result used to list a video playlists videos
  // for the REST API
  'filter:api.video-playlist.videos.list.params': true,
  'filter:api.video-playlist.videos.list.result': true,

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

  // Filter params/result used to list subscription videos for the REST API
  'filter:api.user.me.subscription-videos.list.params': true,
  'filter:api.user.me.subscription-videos.list.result': true,

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

  // Filter params/results when listing video channels
  'filter:api.video-channels.list.params': true,
  'filter:api.video-channels.list.result': true,

  // Filter the result when getting a video channel
  'filter:api.video-channel.get.result': true,

  // Filter the result of the accept upload/live, import via torrent/url functions
  // If this function returns false then the upload is aborted with an error
  'filter:api.video.upload.accept.result': true,
  'filter:api.live-video.create.accept.result': true,
  'filter:api.video.pre-import-url.accept.result': true,
  'filter:api.video.pre-import-torrent.accept.result': true,
  'filter:api.video.post-import-url.accept.result': true,
  'filter:api.video.post-import-torrent.accept.result': true,
  'filter:api.video.update-file.accept.result': true,
  // PeerTube >= 6.1
  'filter:api.video.user-import.accept.result': true,
  // Filter the result of the accept comment (thread or reply) functions
  // If the functions return false then the user cannot post its comment
  'filter:api.video-thread.create.accept.result': true,
  'filter:api.video-comment-reply.create.accept.result': true,

  // Filter attributes when creating video object
  'filter:api.video.upload.video-attribute.result': true,
  'filter:api.video.import-url.video-attribute.result': true,
  'filter:api.video.import-torrent.video-attribute.result': true,
  'filter:api.video.live.video-attribute.result': true,
  // PeerTube >= 6.1
  'filter:api.video.user-import.video-attribute.result': true,

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

  // Filter result used to check if a user can send a registration request on the instance
  // PeerTube >= 5.1
  'filter:api.user.request-signup.allowed.result': true,

  // Filter result used to check if video/torrent download is allowed
  'filter:api.download.video.allowed.result': true,
  'filter:api.download.generated-video.allowed.result': true,
  'filter:api.download.torrent.allowed.result': true,

  // Filter result to check if the embed is allowed for a particular request
  'filter:html.embed.video.allowed.result': true,
  'filter:html.embed.video-playlist.allowed.result': true,

  // Peertube >= 5.2
  'filter:html.client.json-ld.result': true,

  'filter:job-queue.process.params': true,
  'filter:job-queue.process.result': true,

  'filter:transcoding.manual.resolutions-to-transcode.result': true,
  'filter:transcoding.auto.resolutions-to-transcode.result': true,

  'filter:activity-pub.remote-video-comment.create.accept.result': true,

  'filter:activity-pub.activity.context.build.result': true,

  // Filter the result of video JSON LD builder
  // You may also need to use filter:activity-pub.activity.context.build.result to also update JSON LD context
  'filter:activity-pub.video.json-ld.build.result': true,

  // Filter result to allow custom XMLNS definitions in podcast RSS feeds
  // Peertube >= 5.2
  'filter:feed.podcast.rss.create-custom-xmlns.result': true,

  // Filter result to allow custom tags in podcast RSS feeds
  // Peertube >= 5.2
  'filter:feed.podcast.channel.create-custom-tags.result': true,
  // Peertube >= 5.2
  'filter:feed.podcast.video.create-custom-tags.result': true,
  // Peertube >= 6.1
  'filter:api.user.me.get.result': true,

  // Peertube >= 7.1
  'filter:oauth.password-grant.get-user.params': true,
  'filter:api.email-verification.ask-send-verify-email.body': true,
  'filter:api.users.ask-reset-password.body': true
}

export type ServerFilterHookName = keyof typeof serverFilterHookObject

export const serverActionHookObject = {
  // Fired when the application has been loaded and is listening HTTP requests
  'action:application.listening': true,

  // Fired when a new notification is created
  'action:notifier.notification.created': true,

  // API actions hooks give access to the original express `req` and `res` parameters

  // Fired when a local video is updated
  'action:api.video.updated': true,
  // Fired when a local video is deleted
  'action:api.video.deleted': true,
  // Fired when a local video is uploaded
  'action:api.video.uploaded': true,
  // Fired when a local video is viewed
  'action:api.video.viewed': true,

  // Fired when a local video file has been replaced by a new one
  'action:api.video.file-updated': true,

  // Fired when a video channel is created
  'action:api.video-channel.created': true,
  // Fired when a video channel is updated
  'action:api.video-channel.updated': true,
  // Fired when a video channel is deleted
  'action:api.video-channel.deleted': true,

  // Fired when a live video is created
  'action:api.live-video.created': true,
  // Fired when a live video starts or ends
  // Peertube >= 5.2
  'action:live.video.state.updated': true,

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
  // Fired when a user requested registration on the instance
  // PeerTube >= 5.1
  'action:api.user.requested-registration': true,
  // Fired when an admin/moderator created a user
  'action:api.user.created': true,
  // Fired when a user is removed by an admin/moderator
  'action:api.user.deleted': true,
  // Fired when a user is updated by an admin/moderator
  'action:api.user.updated': true,

  // Fired when a user got a new oauth2 token
  'action:api.user.oauth2-got-token': true,

  // Fired when a video is added to a playlist
  'action:api.video-playlist-element.created': true,

  // Fired when a remote video has been created/updated
  'action:activity-pub.remote-video.created': true,
  'action:activity-pub.remote-video.updated': true
}

export type ServerActionHookName = keyof typeof serverActionHookObject

export const serverHookObject = Object.assign({}, serverFilterHookObject, serverActionHookObject)
export type ServerHookName = keyof typeof serverHookObject

export interface ServerHook {
  runHook <T> (hookName: ServerHookName, result?: T, params?: any): Promise<T>
}
