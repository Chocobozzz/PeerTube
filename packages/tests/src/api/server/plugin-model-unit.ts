
import { expect } from 'chai';
import { PluginModel } from '../../../../../dist/core/models/server/plugin.js';
import { PluginType } from '@peertube/peertube-models';

describe('PluginModel.getSetting Unit Test (Manual Mock)', () => {
  const originalFindOne = PluginModel.findOne;

  after(() => {
    PluginModel.findOne = originalFindOne;
  });

  it('should return the default value if the setting is missing in DB', async () => {
    // Mock findOne
    (PluginModel as any).findOne = async () => {
      return {
        settings: {
          other_setting: 'value'
        }
      };
    };

    const registeredSettings = [
      {
        name: 'test-setting',
        default: 'default-value'
      }
    ];

    const result = await PluginModel.getSetting(
      'test-plugin',
      PluginType.PLUGIN,
      'test-setting',
      registeredSettings as any
    );

    expect(result).to.equal('default-value');
  });

  it('should return the saved value if the setting exists in DB', async () => {
    (PluginModel as any).findOne = async () => {
      return {
        settings: {
          'test-setting': 'updated-value'
        }
      };
    };

    const registeredSettings = [
      {
        name: 'test-setting',
        default: 'default-value'
      }
    ];

    const result = await PluginModel.getSetting(
      'test-plugin',
      PluginType.PLUGIN,
      'test-setting',
      registeredSettings as any
    );

    expect(result).to.equal('updated-value');
  });
});
