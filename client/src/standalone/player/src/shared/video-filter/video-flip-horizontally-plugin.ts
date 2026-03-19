import videojs from 'video.js'
import { VideojsPlayer, VideojsPlugin} from '../../types'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin;

class VideoFlipHorizontallyPlugin extends Plugin {
  constructor(player: VideojsPlayer ){
    super(player);
    player.on('video-flip-horizontally-toggle', () => {
      this.player.toggleClass('vjs-vid-flip-h')
    })
  }
  dispose(): void {
    this.player.removeClass('vjs-vid-flip-h')
    super.dispose();
  }
}

videojs.registerPlugin('videoFlipHorizontallyPlugin', VideoFlipHorizontallyPlugin);

export {VideoFlipHorizontallyPlugin};
