import { VideoManage } from './video-manage'

export class VideoUpdatePage extends VideoManage {
  async updateName (videoName: string) {
    const nameInput = $('input#name')

    await nameInput.waitForDisplayed()
    await nameInput.clearValue()
    await nameInput.setValue(videoName)
  }
}
