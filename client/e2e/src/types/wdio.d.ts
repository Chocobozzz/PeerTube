declare global {
  namespace WebdriverIO {
    interface Element {
      chooseFile: (path: string) => Promise<void>
    }
  }
}

export {}
