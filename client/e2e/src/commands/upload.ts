browser.addCommand('chooseFile', async function (this: WebdriverIO.Element, localFilePath: string) {
  try {
    const remoteFile = await browser.uploadFile(localFilePath)

    return this.addValue(remoteFile)
  } catch {
    console.log('Cannot upload file, fallback to add value.')

    // Firefox does not support upload file, but if we're running the test in local we don't really need it
    return this.addValue(localFilePath)
  }
}, true)
