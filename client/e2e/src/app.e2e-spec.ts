import { AppPage } from './po/app.po'

describe('PeerTube app', () => {
  let page: AppPage

  beforeEach(() => {
    page = new AppPage()
  })

  it('Should display the app title', () => {
    page.navigateTo()
    expect(page.getHeaderTitle()).toEqual('PeerTube')
  })
})
