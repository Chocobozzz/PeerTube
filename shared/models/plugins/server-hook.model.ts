// {hookType}:{api?}.{location}.{subLocation?}.{actionType}.{target}

export const serverFilterHookObject = {
  // Filter params/result used to list videos for the REST API
  // (used by the trending page, recently-added page, local page etc)
  'filter:api.videos.list.params': true,
  'filter:api.videos.list.result': true,
  // Filter the result of the get function
  // Used to get detailed video information (video watch page for example)
  'filter:api.video.get.result': true,

  // Filter the result of the accept upload function
  // If this function returns false then the upload is aborted with an error
  'filter:api.video.upload.accept.result': true,
  // Filter the result of the accept comment (thread or reply) functions
  // If the functions return false then the user cannot post its comment
  'filter:api.video-thread.create.accept.result': true,
  'filter:api.video-comment-reply.create.accept.result': true,

  // Filter params/result used to list threads of a specific video
  // (used by the video watch page)
  'filter:api.video-threads.list.params': true,
  'filter:api.video-threads.list.result': true,

  // Filter params/result used to list replies of a specific thread
  // (used by the video watch page when we click on the "View replies" button)
  'filter:api.video-thread-comments.list.params': true,
  'filter:api.video-thread-comments.list.result': true,

  // Filter result used to check if we need to auto blacklist a video
  // (fired when a local or remote video is created or updated)
  'filter:video.auto-blacklist.result': true
}

export type ServerFilterHookName = keyof typeof serverFilterHookObject

export const serverActionHookObject = {
  // Fired when the application has been loaded and is listening HTTP requests
  'action:application.listening': true,

  // Fired when a local video is updated
  'action:api.video.updated': true,
  // Fired when a local video is deleted
  'action:api.video.deleted': true,
  // Fired when a local video is uploaded
  'action:api.video.uploaded': true,
  // Fired when a local video is viewed
  'action:api.video.viewed': true,

  // Fired when a thread is created
  'action:api.video-thread.created': true,
  // Fired when a reply to a thread is created
  'action:api.video-comment-reply.created': true,
  // Fired when a comment (thread or reply) is deleted
  'action:api.video-comment.deleted': true
}

export type ServerActionHookName = keyof typeof serverActionHookObject

export const serverHookObject = Object.assign({}, serverFilterHookObject, serverActionHookObject)
export type ServerHookName = keyof typeof serverHookObject

export interface ServerHook {
  runHook <T> (hookName: ServerHookName, result?: T, params?: any): Promise<T>
}
