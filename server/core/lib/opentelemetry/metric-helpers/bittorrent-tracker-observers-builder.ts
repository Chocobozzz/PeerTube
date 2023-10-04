import { Meter } from '@opentelemetry/api'

export class BittorrentTrackerObserversBuilder {

  constructor (private readonly meter: Meter, private readonly trackerServer: any) {

  }

  buildObservers () {
    const activeInfohashes = this.meter.createObservableGauge('peertube_bittorrent_tracker_active_infohashes_total', {
      description: 'Total active infohashes in the PeerTube BitTorrent Tracker'
    })
    const inactiveInfohashes = this.meter.createObservableGauge('peertube_bittorrent_tracker_inactive_infohashes_total', {
      description: 'Total inactive infohashes in the PeerTube BitTorrent Tracker'
    })
    const peers = this.meter.createObservableGauge('peertube_bittorrent_tracker_peers_total', {
      description: 'Total peers in the PeerTube BitTorrent Tracker'
    })

    this.meter.addBatchObservableCallback(observableResult => {
      const infohashes = Object.keys(this.trackerServer.torrents)

      const counters = {
        activeInfohashes: 0,
        inactiveInfohashes: 0,
        peers: 0,
        uncompletedPeers: 0
      }

      for (const infohash of infohashes) {
        const content = this.trackerServer.torrents[infohash]

        const peers = content.peers
        if (peers.keys.length !== 0) counters.activeInfohashes++
        else counters.inactiveInfohashes++

        for (const peerId of peers.keys) {
          const peer = peers.peek(peerId)
          if (peer == null) return

          counters.peers++
        }
      }

      observableResult.observe(activeInfohashes, counters.activeInfohashes)
      observableResult.observe(inactiveInfohashes, counters.inactiveInfohashes)
      observableResult.observe(peers, counters.peers)
    }, [ activeInfohashes, inactiveInfohashes, peers ])
  }

}
