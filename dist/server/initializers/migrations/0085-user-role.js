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
        const q = utils.queryInterface;
        yield q.renameColumn('Users', 'role', 'oldRole');
        const data = {
            type: Sequelize.INTEGER,
            allowNull: true
        };
        yield q.addColumn('Users', 'role', data);
        let query = 'UPDATE "Users" SET "role" = 0 WHERE "oldRole" = \'admin\'';
        yield utils.sequelize.query(query);
        query = 'UPDATE "Users" SET "role" = 2 WHERE "oldRole" = \'user\'';
        yield utils.sequelize.query(query);
        data.allowNull = false;
        yield q.changeColumn('Users', 'role', data);
        yield q.removeColumn('Users', 'oldRole');
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
//# sourceMappingURL=0085-user-role.js.map