export type ServerFilterHookName =
  'filter:api.videos.list.params' |
  'filter:api.videos.list.result' |
  'filter:api.video.get.result' |

  'filter:api.video.upload.accept.result' |
  'filter:api.video-thread.create.accept.result' |
  'filter:api.video-comment-reply.create.accept.result' |

  'filter:api.video-threads.list.params' |
  'filter:api.video-threads.list.result' |

  'filter:api.video-thread-comments.list.params' |
  'filter:api.video-thread-comments.list.result' |

  'filter:video.auto-blacklist.result'

export type ServerActionHookName =
  'action:application.listening' |

  'action:api.video.updated' |
  'action:api.video.deleted' |
  'action:api.video.uploaded' |
  'action:api.video.viewed' |

  'action:api.video-thread.created' |
  'action:api.video-comment-reply.created' |
  'action:api.video-comment.deleted'

export type ServerHookName = ServerFilterHookName | ServerActionHookName

export interface ServerHook {
  runHook <T> (hookName: ServerHookName, result?: T, params?: any): Promise<T>
}
