import { UserNotificationSetting, UserSettingsExportJSON } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { UserNotificationSettingModel } from '@server/models/user/user-notification-setting.js'
import { exists } from '@server/helpers/custom-validators/misc.js'
import {
  isUserAutoPlayNextVideoPlaylistValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserNSFWPolicyValid,
  isUserP2PEnabledValid,
  isUserVideoLanguages,
  isUserVideosHistoryEnabledValid
} from '@server/helpers/custom-validators/users.js'
import { isThemeNameValid } from '@server/helpers/custom-validators/plugins.js'
import { isThemeRegistered } from '@server/lib/plugins/theme-utils.js'
import { isUserNotificationSettingValid } from '@server/helpers/custom-validators/user-notifications.js'
import { pick } from '@peertube/peertube-core-utils'

const lTags = loggerTagsFactory('user-import')

type SanitizedObject = Pick<UserSettingsExportJSON, 'nsfwPolicy' | 'autoPlayVideo' | 'autoPlayNextVideo' | 'autoPlayNextVideo' |
'autoPlayNextVideoPlaylist' | 'p2pEnabled' | 'videosHistoryEnabled' | 'videoLanguages' | 'theme' | 'notificationSettings'>

export class UserSettingsImporter extends AbstractUserImporter <UserSettingsExportJSON, UserSettingsExportJSON, SanitizedObject> {

  protected getImportObjects (json: UserSettingsExportJSON) {
    return [ json ]
  }

  protected sanitize (o: UserSettingsExportJSON) {
    if (!isUserNSFWPolicyValid(o.nsfwPolicy)) o.nsfwPolicy = undefined
    if (!isUserAutoPlayVideoValid(o.autoPlayVideo)) o.autoPlayVideo = undefined
    if (!isUserAutoPlayNextVideoValid(o.autoPlayNextVideo)) o.autoPlayNextVideo = undefined
    if (!isUserAutoPlayNextVideoPlaylistValid(o.autoPlayNextVideoPlaylist)) o.autoPlayNextVideoPlaylist = undefined
    if (!isUserP2PEnabledValid(o.p2pEnabled)) o.p2pEnabled = undefined
    if (!isUserVideosHistoryEnabledValid(o.videosHistoryEnabled)) o.videosHistoryEnabled = undefined
    if (!isUserVideoLanguages(o.videoLanguages)) o.videoLanguages = undefined
    if (!isThemeNameValid(o.theme) || !isThemeRegistered(o.theme)) o.theme = undefined

    for (const key of Object.keys(o.notificationSettings || {})) {
      if (!isUserNotificationSettingValid(o.notificationSettings[key])) (o.notificationSettings[key] as any) = undefined
    }

    return pick(o, [
      'nsfwPolicy',
      'autoPlayVideo',
      'autoPlayNextVideo',
      'autoPlayNextVideoPlaylist',
      'p2pEnabled',
      'videosHistoryEnabled',
      'videoLanguages',
      'theme',
      'notificationSettings'
    ])
  }

  protected async importObject (userImportData: SanitizedObject) {
    if (exists(userImportData.nsfwPolicy)) this.user.nsfwPolicy = userImportData.nsfwPolicy
    if (exists(userImportData.autoPlayVideo)) this.user.autoPlayVideo = userImportData.autoPlayVideo
    if (exists(userImportData.autoPlayNextVideo)) this.user.autoPlayNextVideo = userImportData.autoPlayNextVideo
    if (exists(userImportData.autoPlayNextVideoPlaylist)) this.user.autoPlayNextVideoPlaylist = userImportData.autoPlayNextVideoPlaylist
    if (exists(userImportData.p2pEnabled)) this.user.p2pEnabled = userImportData.p2pEnabled
    if (exists(userImportData.videosHistoryEnabled)) this.user.videosHistoryEnabled = userImportData.videosHistoryEnabled
    if (exists(userImportData.videoLanguages)) this.user.videoLanguages = userImportData.videoLanguages
    if (exists(userImportData.theme)) this.user.theme = userImportData.theme

    await saveInTransactionWithRetries(this.user)

    await this.updateSettings(userImportData.notificationSettings)

    logger.info('Settings of user %s imported.', this.user.username, lTags())

    return { duplicate: false }
  }

  private async updateSettings (settingsImportData: UserSettingsExportJSON['notificationSettings']) {
    const values: UserNotificationSetting = {
      newVideoFromSubscription: settingsImportData.newVideoFromSubscription,
      newCommentOnMyVideo: settingsImportData.newCommentOnMyVideo,
      myVideoImportFinished: settingsImportData.myVideoImportFinished,
      myVideoPublished: settingsImportData.myVideoPublished,
      abuseAsModerator: settingsImportData.abuseAsModerator,
      videoAutoBlacklistAsModerator: settingsImportData.videoAutoBlacklistAsModerator,
      blacklistOnMyVideo: settingsImportData.blacklistOnMyVideo,
      newUserRegistration: settingsImportData.newUserRegistration,
      commentMention: settingsImportData.commentMention,
      newFollow: settingsImportData.newFollow,
      newInstanceFollower: settingsImportData.newInstanceFollower,
      abuseNewMessage: settingsImportData.abuseNewMessage,
      abuseStateChange: settingsImportData.abuseStateChange,
      autoInstanceFollowing: settingsImportData.autoInstanceFollowing,
      newPeerTubeVersion: settingsImportData.newPeerTubeVersion,
      newPluginVersion: settingsImportData.newPluginVersion,
      myVideoStudioEditionFinished: settingsImportData.myVideoStudioEditionFinished,
      myVideoTranscriptionGenerated: settingsImportData.myVideoTranscriptionGenerated
    }

    await UserNotificationSettingModel.updateUserSettings(values, this.user.id)
  }
}
