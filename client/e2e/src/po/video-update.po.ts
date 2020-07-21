import { by, element } from 'protractor'

export class VideoUpdatePage {

  async updateName (videoName: string) {
    const nameInput = element(by.css('input#name'))
    await nameInput.clear()
    await nameInput.sendKeys(videoName)
  }

  async validUpdate () {
    const submitButton = await this.getSubmitButton()

    return submitButton.click()
  }

  private getSubmitButton () {
    return element(by.css('.submit-container .action-button'))
  }
}
