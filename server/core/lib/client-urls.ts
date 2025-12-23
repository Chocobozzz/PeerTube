import { PluginType_Type } from '@peertube/peertube-models'
import { WEBSERVER } from '@server/initializers/constants.js'
import { MAbuseId, MUserId } from '@server/types/models/index.js'

export const instanceFollowingUrl = `${WEBSERVER.URL}/admin/settings/follows/following-list`
export const instanceFollowersUrl = `${WEBSERVER.URL}/admin/follows/followers-list`
export const videoAutoBlacklistUrl = `${WEBSERVER.URL}/admin/moderation/video-blocks/list`
export const myAccountImportExportUrl = `${WEBSERVER.URL}/my-account/import-export`
export const loginUrl = `${WEBSERVER.URL}/login`
export const adminRegistrationsListUrl = `${WEBSERVER.URL}/admin/moderation/registrations/list`
export const adminUsersListUrl = `${WEBSERVER.URL}/admin/overview/users/list`
export const myVideoImportsUrl = `${WEBSERVER.URL}/my-library/video-imports`

export function getAdminAbuseUrl (abuse: MAbuseId) {
  const suffix = abuse
    ? '?search=%23' + abuse.id
    : ''

  return WEBSERVER.URL + '/admin/moderation/abuses/list' + suffix
}

export function getUserAbuseUrl (abuse: MAbuseId) {
  const suffix = abuse
    ? '?search=%23' + abuse.id
    : ''

  return WEBSERVER.URL + '/my-account/abuses' + suffix
}

export function getResetPasswordUrl (user: MUserId, verificationString: string) {
  return WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
}

export function getPluginUrl (pluginType: PluginType_Type) {
  return WEBSERVER.URL + '/admin/settings/plugins/list-installed?pluginType=' + pluginType
}
