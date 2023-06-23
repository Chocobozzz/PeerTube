import { peertubeTranslate } from '../../../../../shared/core-utils/i18n'
import { VideoDetails } from '../../../../../shared/models'
import { logger } from '../../../root-helpers'
import { Translations } from './translations'

export class PlayerHTML {
  private readonly wrapperElement: HTMLElement

  private playerElement: HTMLVideoElement
  private informationElement: HTMLDivElement

  constructor (private readonly videoWrapperId: string) {
    this.wrapperElement = document.getElementById(this.videoWrapperId)
  }

  getPlayerElement () {
    return this.playerElement
  }

  setPlayerElement (playerElement: HTMLVideoElement) {
    this.playerElement = playerElement
  }

  removePlayerElement () {
    this.playerElement = null
  }

  addPlayerElementToDOM () {
    this.wrapperElement.appendChild(this.playerElement)
  }

  displayError (text: string, translations: Translations) {
    logger.error(text)

    // Remove video element
    if (this.playerElement) {
      this.removeElement(this.playerElement)
      this.playerElement = undefined
    }

    const translatedText = peertubeTranslate(text, translations)
    const translatedSorry = peertubeTranslate('Sorry', translations)

    document.title = translatedSorry + ' - ' + translatedText

    const errorBlock = document.getElementById('error-block')
    errorBlock.style.display = 'flex'

    const errorTitle = document.getElementById('error-title')
    errorTitle.innerHTML = peertubeTranslate('Sorry', translations)

    const errorText = document.getElementById('error-content')
    errorText.innerHTML = translatedText

    this.wrapperElement.style.display = 'none'
  }

  async askVideoPassword (options: { incorrectPassword: boolean, translations: Translations }): Promise<string> {
    const { incorrectPassword, translations } = options
    return new Promise((resolve) => {

      this.removePlaceholder()
      this.wrapperElement.style.display = 'none'

      const translatedTitle = peertubeTranslate('This video is password protected', translations)
      const translatedMessage = peertubeTranslate('You need a password to watch this video.', translations)

      document.title = translatedTitle

      const videoPasswordBlock = document.getElementById('video-password-block')
      videoPasswordBlock.style.display = 'flex'

      const videoPasswordTitle = document.getElementById('video-password-title')
      videoPasswordTitle.innerHTML = translatedTitle

      const videoPasswordMessage = document.getElementById('video-password-content')
      videoPasswordMessage.innerHTML = translatedMessage

      if (incorrectPassword) {
        const videoPasswordError = document.getElementById('video-password-error')
        videoPasswordError.innerHTML = peertubeTranslate('Incorrect password, please enter a correct password', translations)
        videoPasswordError.style.transform = 'scale(1.2)'

        setTimeout(() => {
          videoPasswordError.style.transform = 'scale(1)'
        }, 500)
      }

      const videoPasswordSubmitButton = document.getElementById('video-password-submit')
      videoPasswordSubmitButton.innerHTML = peertubeTranslate('Watch Video', translations)

      const videoPasswordInput = document.getElementById('video-password-input') as HTMLInputElement
      videoPasswordInput.placeholder = peertubeTranslate('Password', translations)

      const videoPasswordForm = document.getElementById('video-password-form')
      videoPasswordForm.addEventListener('submit', (event) => {
        event.preventDefault()
        const videoPassword = videoPasswordInput.value
        resolve(videoPassword)
      })
    })
  }

  removeVideoPasswordBlock () {
    const videoPasswordBlock = document.getElementById('video-password-block')
    videoPasswordBlock.style.display = 'none'
    this.wrapperElement.style.display = 'block'
  }

  buildPlaceholder (video: VideoDetails) {
    const placeholder = this.getPlaceholderElement()

    const url = window.location.origin + video.previewPath
    placeholder.style.backgroundImage = `url("${url}")`
    placeholder.style.display = 'block'
  }

  removePlaceholder () {
    const placeholder = this.getPlaceholderElement()
    placeholder.style.display = 'none'
  }

  displayInformation (text: string, translations: Translations) {
    if (this.informationElement) this.removeInformation()

    this.informationElement = document.createElement('div')
    this.informationElement.className = 'player-information'
    this.informationElement.innerText = peertubeTranslate(text, translations)

    document.body.appendChild(this.informationElement)
  }

  removeInformation () {
    if (!this.informationElement) return

    this.removeElement(this.informationElement)
    this.informationElement = undefined
  }

  private getPlaceholderElement () {
    return document.getElementById('placeholder-preview')
  }

  private removeElement (element: HTMLElement) {
    element.parentElement.removeChild(element)
  }
}
