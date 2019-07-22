export type ClientFilterHookName =
  'filter:api.videos.list.trending.params' |
  'filter:api.videos.list.trending.result' |

  'filter:api.videos.list.local.params' |
  'filter:api.videos.list.local.result' |

  'filter:api.videos.list.recently-added.params' |
  'filter:api.videos.list.recently-added.result' |

  'filter:api.videos.list.user-subscriptions.params' |
  'filter:api.videos.list.user-subscriptions.result' |

  'filter:api.video-watch.video.get.params' |
  'filter:api.video-watch.video.get.result' |

  'filter:api.video-watch.video-threads.list.params' |
  'filter:api.video-watch.video-threads.list.result' |

  'filter:api.video-watch.video-thread-replies.list.params' |
  'filter:api.video-watch.video-thread-replies.list.result' |

  'filter:api.search.videos.list.params' |
  'filter:api.search.videos.list.result' |
  'filter:api.search.video-channels.list.params' |
  'filter:api.search.video-channels.list.result'

export type ClientActionHookName =
  'action:application.init' |

  'action:video-watch.init' |

  'action:video-watch.video.loaded'

export type ClientHookName = ClientActionHookName | ClientFilterHookName

export interface ClientHook {
  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T>
}
