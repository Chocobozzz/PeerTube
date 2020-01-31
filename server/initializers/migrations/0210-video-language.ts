import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    await utils.queryInterface.renameColumn('video', 'language', 'oldLanguage')
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEOS.LANGUAGE.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'language', data)
  }

  {
    const languages = [
      {
        oldLanguage: 1,
        newLanguage: 'en'
      },
      {
        oldLanguage: 2,
        newLanguage: 'es'
      },
      {
        oldLanguage: 3,
        newLanguage: 'zh'
      },
      {
        oldLanguage: 4,
        newLanguage: 'hi'
      },
      {
        oldLanguage: 5,
        newLanguage: 'ar'
      },
      {
        oldLanguage: 6,
        newLanguage: 'pt'
      },
      {
        oldLanguage: 7,
        newLanguage: 'bn'
      },
      {
        oldLanguage: 8,
        newLanguage: 'ru'
      },
      {
        oldLanguage: 9,
        newLanguage: 'ja'
      },
      {
        oldLanguage: 10,
        newLanguage: 'pa'
      },
      {
        oldLanguage: 11,
        newLanguage: 'de'
      },
      {
        oldLanguage: 12,
        newLanguage: 'ko'
      },
      {
        oldLanguage: 13,
        newLanguage: 'fr'
      },
      {
        oldLanguage: 14,
        newLanguage: 'it'
      },
      {
        oldLanguage: 1000,
        newLanguage: 'sgn'
      },
      {
        oldLanguage: 1001,
        newLanguage: 'ase'
      },
      {
        oldLanguage: 1002,
        newLanguage: 'sdl'
      },
      {
        oldLanguage: 1003,
        newLanguage: 'bfi'
      },
      {
        oldLanguage: 1004,
        newLanguage: 'bzs'
      },
      {
        oldLanguage: 1005,
        newLanguage: 'csl'
      },
      {
        oldLanguage: 1006,
        newLanguage: 'cse'
      },
      {
        oldLanguage: 1007,
        newLanguage: 'dsl'
      },
      {
        oldLanguage: 1008,
        newLanguage: 'fsl'
      },
      {
        oldLanguage: 1009,
        newLanguage: 'gsg'
      },
      {
        oldLanguage: 1010,
        newLanguage: 'pks'
      },
      {
        oldLanguage: 1011,
        newLanguage: 'jsl'
      },
      {
        oldLanguage: 1012,
        newLanguage: 'sfs'
      },
      {
        oldLanguage: 1013,
        newLanguage: 'swl'
      },
      {
        oldLanguage: 1014,
        newLanguage: 'rsl'
      }
    ]

    for (const language of languages) {
      const query = 'UPDATE "video" SET "language" = \'' + language.newLanguage + '\' WHERE "oldLanguage" = ' + language.oldLanguage
      await utils.sequelize.query(query)
    }
  }

  {
    await utils.queryInterface.removeColumn('video', 'oldLanguage')
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
