import { PlayerNetworkInfo } from '../peertube-videojs-typings'
import videojs from 'video.js'
import { bytes } from '../utils'

const Button = videojs.getComponent('Button')
class P2pInfoButton extends Button {

  createEl () {
    const div = videojs.dom.createEl('div', {
      className: 'vjs-peertube'
    })
    const subDivWebtorrent = videojs.dom.createEl('div', {
      className: 'vjs-peertube-hidden' // Hide the stats before we get the info
    }) as HTMLDivElement
    div.appendChild(subDivWebtorrent)

    const downloadIcon = videojs.dom.createEl('span', {
      className: 'icon icon-download'
    })
    subDivWebtorrent.appendChild(downloadIcon)

    const downloadSpeedText = videojs.dom.createEl('span', {
      className: 'download-speed-text'
    })
    const downloadSpeedNumber = videojs.dom.createEl('span', {
      className: 'download-speed-number'
    })
    const downloadSpeedUnit = videojs.dom.createEl('span')
    downloadSpeedText.appendChild(downloadSpeedNumber)
    downloadSpeedText.appendChild(downloadSpeedUnit)
    subDivWebtorrent.appendChild(downloadSpeedText)

    const uploadIcon = videojs.dom.createEl('span', {
      className: 'icon icon-upload'
    })
    subDivWebtorrent.appendChild(uploadIcon)

    const uploadSpeedText = videojs.dom.createEl('span', {
      className: 'upload-speed-text'
    })
    const uploadSpeedNumber = videojs.dom.createEl('span', {
      className: 'upload-speed-number'
    })
    const uploadSpeedUnit = videojs.dom.createEl('span')
    uploadSpeedText.appendChild(uploadSpeedNumber)
    uploadSpeedText.appendChild(uploadSpeedUnit)
    subDivWebtorrent.appendChild(uploadSpeedText)

    const peersText = videojs.dom.createEl('span', {
      className: 'peers-text'
    })
    const peersNumber = videojs.dom.createEl('span', {
      className: 'peers-number'
    })
    subDivWebtorrent.appendChild(peersNumber)
    subDivWebtorrent.appendChild(peersText)

    const subDivHttp = videojs.dom.createEl('div', {
      className: 'vjs-peertube-hidden'
    })
    const subDivHttpText = videojs.dom.createEl('span', {
      className: 'http-fallback',
      textContent: 'HTTP'
    })

    subDivHttp.appendChild(subDivHttpText)
    div.appendChild(subDivHttp)

    this.player_.on('p2pInfo', (event: any, data: PlayerNetworkInfo) => {
      // We are in HTTP fallback
      if (!data) {
        subDivHttp.className = 'vjs-peertube-displayed'
        subDivWebtorrent.className = 'vjs-peertube-hidden'

        return
      }

      const p2pStats = data.p2p
      const httpStats = data.http

      const downloadSpeed = bytes(p2pStats.downloadSpeed + httpStats.downloadSpeed)
      const uploadSpeed = bytes(p2pStats.uploadSpeed + httpStats.uploadSpeed)
      const totalDownloaded = bytes(p2pStats.downloaded + httpStats.downloaded)
      const totalUploaded = bytes(p2pStats.uploaded + httpStats.uploaded)
      const numPeers = p2pStats.numPeers

      subDivWebtorrent.title = this.player().localize('Total downloaded: ') + totalDownloaded.join(' ') + '\n' +
        this.player().localize('Total uploaded: ' + totalUploaded.join(' '))

      downloadSpeedNumber.textContent = downloadSpeed[ 0 ]
      downloadSpeedUnit.textContent = ' ' + downloadSpeed[ 1 ]

      uploadSpeedNumber.textContent = uploadSpeed[ 0 ]
      uploadSpeedUnit.textContent = ' ' + uploadSpeed[ 1 ]

      peersNumber.textContent = numPeers.toString()
      peersText.textContent = ' ' + (numPeers > 1 ? this.player().localize('peers') : this.player_.localize('peer'))

      subDivHttp.className = 'vjs-peertube-hidden'
      subDivWebtorrent.className = 'vjs-peertube-displayed'
    })

    return div as HTMLButtonElement
  }
}

videojs.registerComponent('P2PInfoButton', P2pInfoButton)
