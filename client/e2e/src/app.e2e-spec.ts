import { AppPage } from './app.po'

describe('PeerTube app', () => {
  let page: AppPage

  beforeEach(() => {
    page = new AppPage()
  })

  it('should display the app title', () => {
    page.navigateTo()
    expect(page.getHeaderTitle()).toEqual('PeerTube')
  })
})
