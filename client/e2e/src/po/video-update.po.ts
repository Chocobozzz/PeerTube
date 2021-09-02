export class VideoUpdatePage {

  async updateName (videoName: string) {
    const nameInput = $('input#name')

    await nameInput.waitForDisplayed()
    await nameInput.clearValue()
    await nameInput.setValue(videoName)
  }

  async validUpdate () {
    const submitButton = await this.getSubmitButton()

    return submitButton.click()
  }

  private getSubmitButton () {
    return $('.submit-container .action-button')
  }
}
