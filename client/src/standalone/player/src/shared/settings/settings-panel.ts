import videojs from 'video.js'
import { VideojsComponent } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class SettingsPanel extends Component {
  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel',
      tabIndex: -1
    })
  }
}

videojs.registerComponent('SettingsPanel', SettingsPanel)

export { SettingsPanel }
