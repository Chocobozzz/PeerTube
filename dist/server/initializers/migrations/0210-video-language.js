"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Sequelize = require("sequelize");
const index_1 = require("../index");
function up(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        {
            yield utils.queryInterface.renameColumn('video', 'language', 'oldLanguage');
        }
        {
            const data = {
                type: Sequelize.STRING(index_1.CONSTRAINTS_FIELDS.VIDEOS.LANGUAGE.max),
                allowNull: true,
                defaultValue: null
            };
            yield utils.queryInterface.addColumn('video', 'language', data);
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
            ];
            for (const language of languages) {
                const query = 'UPDATE "video" SET "language" = \'' + language.newLanguage + '\' WHERE "oldLanguage" = ' + language.oldLanguage;
                yield utils.sequelize.query(query);
            }
        }
        {
            yield utils.queryInterface.removeColumn('video', 'oldLanguage');
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
