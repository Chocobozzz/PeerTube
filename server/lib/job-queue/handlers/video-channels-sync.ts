/* eslint-disable */
// import { logger } from '@server/helpers/logger'
// import { YoutubeDLCLI, YoutubeDLInfo, YoutubeDLWrapper } from '@server/helpers/youtube-dl'
// import { CONFIG } from '@server/initializers/config'
// import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
// import { ServerConfigManager } from '@server/lib/server-config-manager'
// import { UserModel } from '@server/models/user/user'
// import { VideoModel } from '@server/models/video/video'
// import { VideoChannelModel } from '@server/models/video/video-channel'
// import { VideoImportModel } from '@server/models/video/video-import'
// import {
//   MUser,
//   MVideoThumbnail
// } from '@server/types/models'
// import { ThumbnailType, VideoImportState, VideoPrivacy, VideoState } from '@shared/models'
// import { Hooks } from '@server/lib/plugins/hooks'
// import { JobQueue } from '../job-queue'
// import { updateVideoMiniatureFromUrl } from '@server/lib/thumbnail'
// import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos'
// import { hasUnicastURLsOnly, insertIntoDB, processYoutubeSubtitles } from '@server/helpers/youtube-dl/youtube-dl-import-utils'

// const processOptions = {
//   maxBuffer: 1024 * 1024 * 30 // 30MB
// }
//
// type ChannelSyncInfo = {
//   total: number
//   alreadyImported: number
//   errors: number
//   successes: number
// }
//
// const wait5Secs = () => new Promise(resolve => setTimeout(resolve, 5000))


export async function processVideoChannelsSync () {
  return
  // logger.debug('Running processVideoChannelsSync')
  // const serverConfig = await ServerConfigManager.Instance.getServerConfig()
  // if (!serverConfig.import.videos.http.enabled) {
  //   logger.info('Discard channels synchronization as the HTTP upload is disabled')
  //   return
  // }
  // const syncedChannels: VideoChannelModel[] = await VideoChannelModel.listSynced()
  // const youtubeDL = await YoutubeDLCLI.safeGet()

  // for (const channel of syncedChannels) {
  //   try {
  //     logger.info(`Starting synchronizing "${channel.name}" with external channel "${channel.externalChannelUrl}"`)
  //     const { errors, successes, alreadyImported } = await synchronizeChannel(channel, youtubeDL)
  //     if (errors > 0) {
  //       logger.error(`Finished synchronizing "${channel.name}" with failures` +
  //         ` (failures: ${errors}, imported: ${successes}, ignored because already imported: ${alreadyImported}). Please check the logs.`)
  //     } else {
  //       logger.info(`Finished synchronizing "${channel.name}" successfully` +
  //         ` (imported: ${successes}, ignored because already imported: ${alreadyImported})`)
  //     }
  //   } catch (ex) {
  //     logger.error(`Failed to synchronize channel ${channel.name}: ${ex.stack}`)
  //   }
  // }
}

// async function synchronizeChannel (channel: VideoChannelModel, youtubeDL: YoutubeDLCLI): Promise<ChannelSyncInfo> {
//   // FIXME mettre dans constants.ts
//   const NB_MAX_VIDEOS = 3
//   const result: ChannelSyncInfo = {
//     total: NB_MAX_VIDEOS,
//     errors: 0,
//     successes: 0,
//     alreadyImported: 0
//   }
//   const user = await UserModel.loadByChannelActorId(channel.actorId)
//   const channelInfo = await youtubeDL.getInfo({
//     url: channel.externalChannelUrl,
//     format: YoutubeDLCLI.getYoutubeDLVideoFormat([]),
//     processOptions,
//     additionalYoutubeDLArgs: [ '--skip-download', '--playlist-end', NB_MAX_VIDEOS.toString(), '--playlist-reverse' ]
//   })
//   const targetUrls: string[] = (await Promise.all(channelInfo.map(async video => {
//     const targetUrl = video['webpage_url']
//     const imported = await VideoImportModel.urlAlreadyImported(user.id, targetUrl)
//     return imported ? [] : [ targetUrl ]
//   }))).flat()

//   result.alreadyImported = NB_MAX_VIDEOS - targetUrls.length

//   await wait5Secs()

//   for (const targetUrl of targetUrls) {
//     try {
//       await addYoutubeDLImport({
//         user,
//         channel,
//         targetUrl
//       })
//       result.successes += 1
//     } catch (ex) {
//       result.errors += 1
//       logger.error(`An error occured while importing ${targetUrl}: ${ex.stack}`)
//     }
//     await wait5Secs()
//   }
//   return result
// }

// async function buildVideo (channelId: number, targetUrl: string, importData: YoutubeDLInfo): Promise<MVideoThumbnail> {
//   let videoData = {
//     name: importData.name ?? 'Unknown name',
//     remote: false,
//     category: importData.category,
//     licence: importData.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
//     language: importData.language,
//     commentsEnabled: CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
//     downloadEnabled: CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
//     waitTranscoding: false,
//     state: VideoState.TO_IMPORT,
//     nsfw: importData.nsfw ?? false,
//     description: importData.description,
//     support: null,
//     privacy: VideoPrivacy.PUBLIC,
//     duration: 0, // duration will be set by the import job
//     channelId: channelId,
//     originallyPublishedAt: importData.originallyPublishedAt
//   }

//   videoData = await Hooks.wrapObject(
//     videoData,
//     'filter:api.video.import-url.video-attribute.result'
//   )

//   const video = new VideoModel(videoData)
//   video.url = getLocalVideoActivityPubUrl(video)

//   return video
// }

// async function addYoutubeDLImport (parameters: {
//   user: MUser
//   channel: VideoChannelModel
//   targetUrl: string
// }) {
//   const { user, channel, targetUrl } = parameters
//   const youtubeDL = new YoutubeDLWrapper(targetUrl, ServerConfigManager.Instance.getEnabledResolutions('vod'))
//   // Get video infos
//   let youtubeDLInfo: YoutubeDLInfo
//   try {
//     youtubeDLInfo = await youtubeDL.getInfoForDownload()
//   } catch (err) {
//     err.message = `Cannot fetch information from import for URL ${targetUrl}: ${err.message}`
//     throw err
//   }
//   if (!await hasUnicastURLsOnly(youtubeDLInfo)) {
//     throw new Error('Cannot use non unicast IP as targetUrl.')
//   }
//   const video = await buildVideo(channel.id, targetUrl, youtubeDLInfo)
//   let thumbnailModel
//   let previewModel
//   if (youtubeDLInfo.thumbnailUrl) {
//     // Process video thumbnail from url
//     try {
//       thumbnailModel = await updateVideoMiniatureFromUrl({ downloadUrl: youtubeDLInfo.thumbnailUrl, video, type: ThumbnailType.MINIATURE })
//     } catch (err) {
//       logger.warn('Cannot process thumbnail %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
//     }

//     // Process video preview from url
//     try {
//       previewModel = await updateVideoMiniatureFromUrl({ downloadUrl: youtubeDLInfo.thumbnailUrl, video, type: ThumbnailType.PREVIEW })
//     } catch (err) {
//       logger.warn('Cannot process preview %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
//     }
//   }

//   const videoImport = await insertIntoDB({
//     video,
//     thumbnailModel,
//     previewModel,
//     videoChannel: channel,
//     tags: youtubeDLInfo.tags,
//     user: user.id,
//     videoImportAttributes: {
//       targetUrl,
//       state: VideoImportState.PENDING,
//       userId: user.id
//     }
//   })

//   // Get video subtitles
//   await processYoutubeSubtitles(youtubeDL, targetUrl, video.id)

//   let fileExt = `.${youtubeDLInfo.ext}`
//   if (!isVideoFileExtnameValid(fileExt)) fileExt = '.mp4'

//   // Create job to import the video
//   const payload = {
//     type: 'youtube-dl' as 'youtube-dl',
//     videoImportId: videoImport.id,
//     fileExt
//   }
//   JobQueue.Instance.createJob({ type: 'video-import', payload })
// }
