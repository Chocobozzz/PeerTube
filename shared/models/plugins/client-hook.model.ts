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
  'filter:api.search.video-channels.list.result': true,

  // Filter form
  'filter:api.signup.registration.create.params': true,

  // Filter the options to create our player
  'filter:internal.video-watch.player.build-options.params': true,
  'filter:internal.video-watch.player.build-options.result': true,

  // Filter our SVG icons content
  'filter:internal.common.svg-icons.get-content.params': true,
  'filter:internal.common.svg-icons.get-content.result': true
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

  // Fired when the login page is being initialized
  'action:login.init': true,

  // Fired when the search page is being initialized
  'action:search.init': true,

  // Fired every time Angular URL changes
  'action:router.navigation-end': true,

  // Fired when the registration page is being initialized
  'action:signup.register.init': true
}

export type ClientActionHookName = keyof typeof clientActionHookObject

export const clientHookObject = Object.assign({}, clientFilterHookObject, clientActionHookObject)
export type ClientHookName = keyof typeof clientHookObject

export interface ClientHook {
  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T>
}
