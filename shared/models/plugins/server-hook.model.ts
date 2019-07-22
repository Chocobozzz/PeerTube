export const serverFilterHookObject = {
  'filter:api.videos.list.params': true,
  'filter:api.videos.list.result': true,
  'filter:api.video.get.result': true,

  'filter:api.video.upload.accept.result': true,
  'filter:api.video-thread.create.accept.result': true,
  'filter:api.video-comment-reply.create.accept.result': true,

  'filter:api.video-threads.list.params': true,
  'filter:api.video-threads.list.result': true,

  'filter:api.video-thread-comments.list.params': true,
  'filter:api.video-thread-comments.list.result': true,

  'filter:video.auto-blacklist.result': true
}

export type ServerFilterHookName = keyof typeof serverFilterHookObject

export const serverActionHookObject = {
  'action:application.listening': true,

  'action:api.video.updated': true,
  'action:api.video.deleted': true,
  'action:api.video.uploaded': true,
  'action:api.video.viewed': true,

  'action:api.video-thread.created': true,
  'action:api.video-comment-reply.created': true,
  'action:api.video-comment.deleted': true
}

export type ServerActionHookName = keyof typeof serverActionHookObject

export const serverHookObject = Object.assign({}, serverFilterHookObject, serverActionHookObject)
export type ServerHookName = keyof typeof serverHookObject

export interface ServerHook {
  runHook <T> (hookName: ServerHookName, result?: T, params?: any): Promise<T>
}
