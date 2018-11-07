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
        yield utils.queryInterface.removeColumn('server', 'score');
        const data = {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: index_1.ACTOR_FOLLOW_SCORE.BASE
        };
        yield utils.queryInterface.addColumn('actorFollow', 'score', data);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
