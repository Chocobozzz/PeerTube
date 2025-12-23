import { VideoCreateUpdateCommon } from './video-create-update-common.model.js'

export interface VideoUpdate extends VideoCreateUpdateCommon {
  pluginData?: any
}
