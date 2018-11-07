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
                allowNull: false,
                defaultValue: true
            };
            yield utils.queryInterface.addColumn('user', 'webTorrentEnabled', data);
        }
    });
}
exports.up = up;
function down(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        yield utils.queryInterface.removeColumn('user', 'webTorrentEnabled');
    });
}
exports.down = down;
//# sourceMappingURL=0280-webtorrent-policy-user.js.map