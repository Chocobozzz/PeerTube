import {
  ActivityCreate,
  VideoTorrentObject,
  VideoChannelObject
} from '../../../shared'

function processUpdateActivity (activity: ActivityCreate) {
  if (activity.object.type === 'Video') {
    return processUpdateVideo(activity.object)
  } else if (activity.object.type === 'VideoChannel') {
    return processUpdateVideoChannel(activity.object)
  }
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

function processUpdateVideo (video: VideoTorrentObject) {

}

function processUpdateVideoChannel (videoChannel: VideoChannelObject) {

}
