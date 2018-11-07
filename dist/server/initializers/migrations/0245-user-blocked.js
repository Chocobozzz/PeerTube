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
function up(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        {
            const data = {
                type: Sequelize.BOOLEAN,
                allowNull: true,
                defaultValue: null
            };
            yield utils.queryInterface.addColumn('user', 'blocked', data);
        }
        {
            const query = 'UPDATE "user" SET "blocked" = false';
            yield utils.sequelize.query(query);
        }
        {
            const data = {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: null
            };
            yield utils.queryInterface.changeColumn('user', 'blocked', data);
        }
        {
            const data = {
                type: Sequelize.STRING(250),
                allowNull: true,
                defaultValue: null
            };
            yield utils.queryInterface.addColumn('user', 'blockedReason', data);
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
