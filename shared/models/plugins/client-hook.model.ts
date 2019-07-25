// Data from API hooks: {hookType}:api.{location}.{elementType}.{actionType}.{target}

export const clientFilterHookObject = {
  // Filter params/result of the function that fetch videos of the trending page
  'filter:api.trending-videos.videos.list.params': true,
  'filter:api.trending-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the local page
  'filter:api.local-videos.videos.list.params': true,
  'filter:api.local-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the recently-added page
  'filter:api.recently-added-videos.videos.list.params': true,
  'filter:api.recently-added-videos.videos.list.result': true,

  // Filter params/result of the function that fetch videos of the user subscription page
  'filter:api.user-subscriptions-videos.videos.list.params': true,
  'filter:api.user-subscriptions-videos.videos.list.result': true,

  // Filter params/result of the function that fetch the video of the video-watch page
  'filter:api.video-watch.video.get.params': true,
  'filter:api.video-watch.video.get.result': true,

  // Filter params/result of the function that fetch the threads of the video-watch page
  'filter:api.video-watch.video-threads.list.params': true,
  'filter:api.video-watch.video-threads.list.result': true,

  // Filter params/result of the function that fetch the replies of a thread in the video-watch page
  'filter:api.video-watch.video-thread-replies.list.params': true,
  'filter:api.video-watch.video-thread-replies.list.result': true,

  // Filter params/result of the function that fetch videos according to the user search
  'filter:api.search.videos.list.params': true,
  'filter:api.search.videos.list.result': true,
  // Filter params/result of the function that fetch video-channels according to the user search
  'filter:api.search.video-channels.list.params': true,
  'filter:api.search.video-channels.list.result': true
}

export type ClientFilterHookName = keyof typeof clientFilterHookObject

export const clientActionHookObject = {
  // Fired when the application is being initialized
  'action:application.init': true,

  // Fired when the video watch page is being initialized
  'action:video-watch.init': true,
  // Fired when the video watch page loaded the video
  'action:video-watch.video.loaded': true,

  // Fired when the search page is being initialized
  'action:search.init': true,

  // Fired every time Angular URL changes
  'action:router.navigation-end': true
}

export type ClientActionHookName = keyof typeof clientActionHookObject

export const clientHookObject = Object.assign({}, clientFilterHookObject, clientActionHookObject)
export type ClientHookName = keyof typeof clientHookObject

export interface ClientHook {
  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T>
}
