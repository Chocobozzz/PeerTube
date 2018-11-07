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
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: Sequelize.NOW
            };
            yield utils.queryInterface.addColumn('video', 'publishedAt', data);
        }
        {
            const query = 'UPDATE video SET "publishedAt" = video."createdAt"';
            yield utils.sequelize.query(query);
        }
        {
            const data = {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            };
            yield utils.queryInterface.changeColumn('video', 'publishedAt', data);
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
//# sourceMappingURL=0200-video-published-at.js.map