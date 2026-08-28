export type VideoLifecycleActionType = 'delete-resolutions'

export interface VideoLifecycleDeleteResolutionsAction {
  type: 'delete-resolutions'

  // 'max': keep the max resolution of the video, delete every lower resolution
  keep: 'max'
}

export type VideoLifecycleAction = VideoLifecycleDeleteResolutionsAction
