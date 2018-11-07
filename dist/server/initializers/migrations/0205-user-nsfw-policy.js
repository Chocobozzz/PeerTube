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
                type: Sequelize.ENUM('do_not_list', 'blur', 'display'),
                allowNull: true,
                defaultValue: null
            };
            yield utils.queryInterface.addColumn('user', 'nsfwPolicy', data);
        }
        {
            const query = 'UPDATE "user" SET "nsfwPolicy" = \'do_not_list\'';
            yield utils.sequelize.query(query);
        }
        {
            const query = 'UPDATE "user" SET "nsfwPolicy" = \'display\' WHERE "displayNSFW" = true';
            yield utils.sequelize.query(query);
        }
        {
            const query = 'ALTER TABLE "user" ALTER COLUMN "nsfwPolicy" SET NOT NULL';
            yield utils.sequelize.query(query);
        }
        {
            yield utils.queryInterface.removeColumn('user', 'displayNSFW');
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
