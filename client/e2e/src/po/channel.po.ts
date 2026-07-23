import { join } from 'node:path'
import { go, selectCustomSelect } from '../utils'

export class ChannelPage {
  private currentChannelName: string

  readonly avatarPath = join(__dirname, '../../../src/assets/images/default-avatar-video-channel.png')
  readonly bannerPath = join(__dirname, '../../../src/assets/images/favicon.png')

  async navigateToCreate () {
    await go('/my-library/video-channels/create')
    await $('#name').waitForDisplayed()
  }

  async createChannel (options: {
    name: string
    displayName: string
  }) {
    await this.navigateToCreate()

    this.currentChannelName = options.name

    await this.fillName(options.name)
    await this.fillDisplayName(options.displayName)
    await this.save()
    await this.waitForManagePage(options.name)
  }

  async updateDisplayName (displayName: string) {
    await this.fillDisplayName(displayName)
    await this.save()
  }

  async updateDescription (description: string) {
    await this.fillDescription(description)
    await this.save()
  }

  async updateSupport (support: string) {
    await this.fillSupport(support)
    await this.save()
  }

  async updatePlayerTheme (theme: string) {
    await selectCustomSelect('playerTheme', theme)
    await this.save()
  }

  async uploadAvatar (filePath = this.avatarPath) {
    await this.prepareImageInput('my-actor-avatar-edit input#avatarfile')
    await $('my-actor-avatar-edit input#avatarfile').chooseFile(filePath)
  }

  async uploadBanner (filePath = this.bannerPath) {
    await this.prepareImageInput('my-actor-banner-edit input#bannerfile')
    await $('my-actor-banner-edit input#bannerfile').chooseFile(filePath)
  }

  async openEditorPage (channelName = this.currentChannelName) {
    await go(`/my-library/video-channels/manage/${channelName}/editors`)

    await $('#addEditor').waitForDisplayed()
  }

  async inviteCollaborator (username: string) {
    const editorInput = $('#addEditor')
    await editorInput.waitForDisplayed()
    await editorInput.setValue(username)

    const inviteButton = $('my-video-channel-editors').$('button*=Invite')
    await inviteButton.waitForClickable()
    await inviteButton.click()

    const confirmInviteButton = $('.modal-content .modal-footer input.primary-button')
    await confirmInviteButton.waitForClickable()
    await confirmInviteButton.click()
  }

  async removeCollaborator (displayName: string) {
    const collaboratorBlock = await this.getCollaboratorBlock(displayName)
    const actionButton = collaboratorBlock.$('my-action-dropdown .action-button')

    await actionButton.waitForClickable()
    await actionButton.click()

    const deleteAction = await this.getDeleteCollaboratorAction()
    await deleteAction.waitForClickable()
    await deleteAction.click()

    const confirmButton = $('.modal-content .modal-footer input.primary-button')
    await confirmButton.waitForClickable()
    await confirmButton.click()
  }

  async save () {
    const saveButton = $('.save-button > button:not([disabled])')
    await saveButton.waitForClickable()
    await saveButton.click()
    await $('.save-button > button[disabled]').waitForDisplayed()
  }

  async waitForManagePage (channelName: string) {
    await browser.waitUntil(async () => {
      const url = await browser.getUrl()

      return url.includes(`/my-library/video-channels/manage/${channelName}`)
    })
  }

  async refreshManagePage () {
    await browser.refresh()
    await $('#displayName').waitForDisplayed()
  }

  async expectManageDisplayName (displayName: string) {
    await expect($('.actions h2')).toHaveText(expect.stringContaining(displayName))
  }

  async expectPlayerTheme (theme: string) {
    await expect($('[formcontrolname=playerTheme] span[role=combobox]')).toHaveText(expect.stringContaining(theme))
  }

  async expectBannerAndAvatarSaved () {
    await $('my-actor-banner-edit .banner-placeholder img').waitForDisplayed()
    await $('my-actor-avatar-edit my-actor-avatar img').waitForDisplayed()
  }

  async expectCollaboratorInvited (displayName: string) {
    const collaboratorBlock = await this.getCollaboratorBlock(displayName)

    expect(await collaboratorBlock.getText()).toContain(displayName)
    expect(await collaboratorBlock.getText()).toContain('Invitation sent')
  }

  async expectCollaboratorAccepted (displayName: string) {
    const collaboratorBlock = await this.getCollaboratorBlock(displayName)

    expect(await collaboratorBlock.getText()).toContain(displayName)
    expect(await collaboratorBlock.getText()).toContain('Editor')
  }

  async expectNoCollaborators () {
    await expect($('.collaborators')).toHaveText(expect.stringContaining('No editors at the moment'))
  }

  async getAvatarSrc () {
    const el = $('my-actor-avatar-edit my-actor-avatar img')
    if (!await el.isExisting()) return ''

    return el.getAttribute('src')
  }

  async goToPublicPage (channelName: string) {
    await go(`/c/${channelName}`)
    await $('.actor-display-name h1').waitForDisplayed()
  }

  async expectPublicPage (options: {
    displayName: string
    description: string
    support: string
  }) {
    await expect($('.actor-display-name h1')).toHaveText(options.displayName)
    await expect($('.channel-description .description-html')).toHaveText(expect.stringContaining(options.description))

    await $('.support-button').waitForClickable()
    await $('.support-button').click()

    await expect($('.modal-body')).toHaveText(expect.stringContaining(options.support))
    await $('.modal-footer input[value="Close"]').click()

    await $('.banner img').waitForDisplayed()
    await $('.channel-avatar-row my-actor-avatar img').waitForDisplayed()
  }

  async expectListedInMyVideoChannels (displayName: string) {
    await go('/my-library/video-channels')
    await $(`.display-name*=${displayName}`).waitForDisplayed()
  }

  private async fillName (name: string) {
    const nameInput = $('#name')
    await nameInput.waitForDisplayed()
    await nameInput.setValue(name)
  }

  private async fillDisplayName (displayName: string) {
    const displayNameInput = $('#displayName')
    await displayNameInput.waitForDisplayed()
    await displayNameInput.clearValue()
    await displayNameInput.setValue(displayName)
  }

  private async fillDescription (description: string) {
    const descriptionInput = $('#description')
    await descriptionInput.waitForDisplayed()
    await descriptionInput.clearValue()
    await descriptionInput.setValue(description)
  }

  private async fillSupport (support: string) {
    const supportInput = $('#support')
    await supportInput.waitForDisplayed()
    await supportInput.clearValue()
    await supportInput.setValue(support)
  }

  private async prepareImageInput (selector: string) {
    await browser.execute((imageSelector: string) => {
      const input = document.querySelector(imageSelector)

      if (input instanceof HTMLInputElement) input.style.opacity = '1'
    }, selector)

    await $(selector).waitForExist()
  }

  private async getCollaboratorBlock (displayName: string) {
    let matchingBlock: WebdriverIO.Element | undefined

    await browser.waitUntil(async () => {
      const blocks = $$('.collaborators .collaborator-block')

      await blocks.forEach(async block => {
        if (!block) return

        const text = await block.getText()
        if (text.includes(displayName)) {
          matchingBlock = block
          return true
        }
      })

      if (matchingBlock) return true
    })

    if (!matchingBlock) throw new Error(`Cannot find collaborator block for ${displayName}`)

    return matchingBlock
  }

  private async getDeleteCollaboratorAction () {
    let action: WebdriverIO.Element

    await browser.waitUntil(() => {
      return $$('.dropdown-menu .custom-action').some(async el => {
        if ((await el.getText()).includes('Delete')) {
          action = el
          return true
        }

        return false
      })
    })

    return action
  }
}
