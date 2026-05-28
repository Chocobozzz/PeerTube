import { AdminUserPage } from '../po/admin-user.po'
import { ChannelPage } from '../po/channel.po'
import { LoginPage } from '../po/login.po'
import { NotificationPage } from '../po/notification.po'
import { isMobileDevice, prepareWebBrowser, waitServerUp } from '../utils'

describe('Channel management', () => {
  let loginPage: LoginPage
  let adminUserPage: AdminUserPage
  let channelPage: ChannelPage
  let notificationPage: NotificationPage

  const seed = Math.random().toString().slice(2, 10)
  const classicUsername = `classic_user_${seed}`
  const classicUserPassword = 'superpassword'
  const collaboratorUsername = `collaborator_user_${seed}`
  const collaboratorPassword = 'superpassword'
  const channelName = `channel_${seed}`
  const channelDisplayName = `Channel ${seed}`
  const updatedChannelDisplayName = `Updated channel ${seed}`
  const updatedDescription = `Description ${seed}`
  const updatedSupport = `Support ${seed}`
  const updatedTheme = 'Lucide'

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    adminUserPage = new AdminUserPage()
    channelPage = new ChannelPage()
    notificationPage = new NotificationPage()

    await prepareWebBrowser()
  })

  describe('Classic user channel management', function () {
    it('Should create a classic user', async function () {
      await loginPage.loginAsRootUser()

      await adminUserPage.createUser({
        username: classicUsername,
        password: classicUserPassword
      })

      await loginPage.logout()
    })

    it('Should create a collaborator user', async function () {
      await loginPage.loginAsRootUser()

      await adminUserPage.createUser({
        username: collaboratorUsername,
        password: collaboratorPassword
      })

      await loginPage.logout()
    })

    it('Should create a channel', async function () {
      await loginPage.login({ username: classicUsername, password: classicUserPassword })

      await channelPage.createChannel({
        name: channelName,
        displayName: channelDisplayName
      })

      await channelPage.expectManageDisplayName(channelDisplayName)
    })

    it('Should update the created channel', async function () {
      await channelPage.updateDisplayName(updatedChannelDisplayName)
    })

    it('Should update the channel description', async function () {
      await channelPage.updateDescription(updatedDescription)
    })

    it('Should update the channel support text', async function () {
      await channelPage.updateSupport(updatedSupport)
    })

    it('Should update the channel player theme', async function () {
      await channelPage.updatePlayerTheme(updatedTheme)

      await channelPage.refreshManagePage()
      await channelPage.expectPlayerTheme(updatedTheme)
    })

    it('Should update the channel banner and avatar', async function () {
      const previousAvatarSrc = await channelPage.getAvatarSrc()

      await channelPage.uploadBanner()
      await channelPage.uploadAvatar()
      await channelPage.save()

      await channelPage.refreshManagePage()
      await channelPage.expectBannerAndAvatarSaved()

      const updatedAvatarSrc = await channelPage.getAvatarSrc()
      expect(updatedAvatarSrc).not.toEqual(previousAvatarSrc)
    })

    it('Should display updated channel data on public page', async function () {
      await channelPage.goToPublicPage(channelName)
      await channelPage.expectPublicPage({
        displayName: updatedChannelDisplayName,
        description: updatedDescription,
        support: updatedSupport
      })

      await channelPage.expectListedInMyVideoChannels(updatedChannelDisplayName)
    })

    it('Should invite a collaborator to the channel', async function () {
      await channelPage.openEditorPage()
      await channelPage.inviteCollaborator(collaboratorUsername)
      await channelPage.expectCollaboratorInvited(collaboratorUsername)
    })

    it('Should let the collaborator accept the invitation and see the channel', async function () {
      await loginPage.logout()
      await loginPage.login({ username: collaboratorUsername, password: collaboratorPassword })

      await notificationPage.navigateTo()
      await notificationPage.acceptChannelCollaborationInvitation(updatedChannelDisplayName)
      await channelPage.expectListedInMyVideoChannels(updatedChannelDisplayName)

      await loginPage.logout()
      await loginPage.login({ username: classicUsername, password: classicUserPassword })

      await channelPage.openEditorPage()
      await channelPage.expectCollaboratorAccepted(collaboratorUsername)
    })

    it('Should remove the collaborator from the channel', async function () {
      await channelPage.openEditorPage()

      await channelPage.removeCollaborator(collaboratorUsername)
      await channelPage.expectNoCollaborators()
    })
  })
})
