import videojs from 'video.js'
import { VideojsComponent } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class SettingsPanelChild extends Component {
  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel-child',
      tabIndex: -1
    })
  }
}

videojs.registerComponent('SettingsPanelChild', SettingsPanelChild)

export { SettingsPanelChild }
