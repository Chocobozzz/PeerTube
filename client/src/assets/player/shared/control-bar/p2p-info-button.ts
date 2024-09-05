import videojs from 'video.js'
import { PlayerNetworkInfo } from '../../types'
import { bytes } from '../common'

const Button = videojs.getComponent('Button')
class P2PInfoButton extends Button {

  createEl () {
    const div = videojs.dom.createEl('div', { className: 'vjs-peertube' })
    const subDivP2P = videojs.dom.createEl('div', {
      className: 'vjs-peertube-hidden' // Hide the stats before we get the info
    }) as HTMLDivElement
    div.appendChild(subDivP2P)

    const downloadIcon = videojs.dom.createEl('span', { className: 'icon icon-download' })
    subDivP2P.appendChild(downloadIcon)

    const downloadSpeedText = videojs.dom.createEl('span', { className: 'download-speed-text' })
    const downloadSpeedNumber = videojs.dom.createEl('span', { className: 'download-speed-number' })
    const downloadSpeedUnit = videojs.dom.createEl('span')
    downloadSpeedText.appendChild(downloadSpeedNumber)
    downloadSpeedText.appendChild(downloadSpeedUnit)
    subDivP2P.appendChild(downloadSpeedText)

    const uploadIcon = videojs.dom.createEl('span', { className: 'icon icon-upload' })
    subDivP2P.appendChild(uploadIcon)

    const uploadSpeedText = videojs.dom.createEl('span', { className: 'upload-speed-text' })
    const uploadSpeedNumber = videojs.dom.createEl('span', { className: 'upload-speed-number' })
    const uploadSpeedUnit = videojs.dom.createEl('span')
    uploadSpeedText.appendChild(uploadSpeedNumber)
    uploadSpeedText.appendChild(uploadSpeedUnit)
    subDivP2P.appendChild(uploadSpeedText)

    const peersText = videojs.dom.createEl('span', { className: 'peers-text' })
    const peersNumber = videojs.dom.createEl('span', { className: 'peers-number' })
    subDivP2P.appendChild(peersNumber)
    subDivP2P.appendChild(peersText)

    const subDivHttp = videojs.dom.createEl('div', { className: 'vjs-peertube-hidden' }) as HTMLElement
    const subDivHttpText = videojs.dom.createEl('span', { className: 'http-fallback' })

    subDivHttp.appendChild(subDivHttpText)
    div.appendChild(subDivHttp)

    this.player_.on('network-info', (_event: any, data: PlayerNetworkInfo) => {
      if (!data.p2p) return

      subDivP2P.className = 'vjs-peertube-displayed'
      subDivHttp.className = 'vjs-peertube-hidden'

      const p2pStats = data.p2p
      const httpStats = data.http

      const downloadSpeed = bytes(p2pStats.downloadSpeed + httpStats.downloadSpeed)
      const uploadSpeed = bytes(p2pStats.uploadSpeed)
      const totalDownloaded = bytes(p2pStats.downloaded + httpStats.downloaded)
      const totalUploaded = bytes(p2pStats.uploaded)
      const numPeers = p2pStats.peersWithWebSeed

      subDivP2P.title = this.player().localize('Total downloaded: ') + totalDownloaded.join(' ') + '\n'

      if (data.source === 'p2p-media-loader') {
        const downloadedFromServer = bytes(httpStats.downloaded).join(' ')
        const downloadedFromPeers = bytes(p2pStats.downloaded).join(' ')

        subDivP2P.title +=
          ' * ' + this.player().localize('From servers: ') + downloadedFromServer + '\n' +
          ' * ' + this.player().localize('From peers: ') + downloadedFromPeers + '\n'
      }
      subDivP2P.title += this.player().localize('Total uploaded: ') + totalUploaded.join(' ')

      downloadSpeedNumber.textContent = downloadSpeed[0]
      downloadSpeedUnit.textContent = ' ' + downloadSpeed[1]

      uploadSpeedNumber.textContent = uploadSpeed[0]
      uploadSpeedUnit.textContent = ' ' + uploadSpeed[1]

      peersNumber.textContent = numPeers.toString()
      peersText.textContent = ' ' + (numPeers > 1 ? this.player().localize('peers') : this.player_.localize('peer'))

      subDivHttp.className = 'vjs-peertube-hidden'
      subDivP2P.className = 'vjs-peertube-displayed'
    })

    this.player_.on('network-info', (_event, data: PlayerNetworkInfo) => {
      if (data.p2p) return

      if (data.source === 'web-video') subDivHttpText.textContent = 'HTTP'
      else if (data.source === 'p2p-media-loader') subDivHttpText.textContent = 'HLS'

      // We are in HTTP mode
      subDivHttp.className = 'vjs-peertube-displayed'
      subDivP2P.className = 'vjs-peertube-hidden'

      subDivHttp.title = this.player().localize('Total downloaded: ') + bytes(data.http.downloaded).join(' ')
    })

    this.player_.on('video-change', () => {
      subDivP2P.className = 'vjs-peertube-hidden'
      subDivHttp.className = 'vjs-peertube-hidden'
    })

    return div as HTMLButtonElement
  }
}

videojs.registerComponent('P2PInfoButton', P2PInfoButton)
