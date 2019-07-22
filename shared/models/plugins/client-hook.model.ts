// Data from API hooks: {hookType}:api.{location}.{elementType}.{actionType}.{target}

export const clientFilterHookObject = {
  'filter:api.trending-videos.videos.list.params': true,
  'filter:api.trending-videos.videos.list.result': true,

  'filter:api.local-videos.videos.list.params': true,
  'filter:api.local-videos.videos.list.result': true,

  'filter:api.recently-added-videos.videos.list.params': true,
  'filter:api.recently-added-videos.videos.list.result': true,

  'filter:api.user-subscriptions-videos.videos.list.params': true,
  'filter:api.user-subscriptions-videos.videos.list.result': true,

  'filter:api.video-watch.video.get.params': true,
  'filter:api.video-watch.video.get.result': true,

  'filter:api.video-watch.video-threads.list.params': true,
  'filter:api.video-watch.video-threads.list.result': true,

  'filter:api.video-watch.video-thread-replies.list.params': true,
  'filter:api.video-watch.video-thread-replies.list.result': true,

  'filter:api.search.videos.list.params': true,
  'filter:api.search.videos.list.result': true,
  'filter:api.search.video-channels.list.params': true,
  'filter:api.search.video-channels.list.result': true
}

export type ClientFilterHookName = keyof typeof clientFilterHookObject

export const clientActionHookObject = {
  'action:application.init': true,

  'action:video-watch.init': true,
  'action:video-watch.video.loaded': true,

  'action:search.init': true
}

export type ClientActionHookName = keyof typeof clientActionHookObject

export const clientHookObject = Object.assign({}, clientFilterHookObject, clientActionHookObject)
export type ClientHookName = keyof typeof clientHookObject

export interface ClientHook {
  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T>
}
