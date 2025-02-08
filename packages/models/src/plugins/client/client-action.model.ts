export const clientDoActionObject = {
  'admin-abuse-list:load-data': true,
  'application:increment-loader': true,
  'application:decrement-loader': true,
  'admin-users-list:load-data': true,
  'admin-video-comment-list:load-data': true,
  'video-watch-comment-list:load-data': true
}

export type ClientDoActionName = keyof typeof clientDoActionObject

export type ClientDoActionCallback = () => Promise<any>
export type ClientDoAction = (actionName: ClientDoActionName) => Promise<any>
