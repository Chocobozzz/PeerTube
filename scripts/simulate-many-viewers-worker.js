import Bluebird from "bluebird";
import { PeerTubeServer } from "@peertube/peertube-server-commands";
module.exports = async function sendViews(options) {
  const { url, videoId, viewers } = options;
  const server = new PeerTubeServer({ url });
  await Bluebird.map(viewers, (viewer) => {
    return server.views.simulateView({ id: videoId, xForwardedFor: viewer.xForwardedFor }).catch((err) => console.error("Cannot simulate viewer", err));
  }, { concurrency: 500 });
};
