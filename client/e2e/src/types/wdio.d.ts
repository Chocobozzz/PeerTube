declare namespace WebdriverIO {
  interface Element {
    chooseFile: (path: string) => Promise<void>
  }
}
