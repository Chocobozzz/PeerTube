"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var ServerBlocklistModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const account_1 = require("../account/account");
const server_1 = require("./server");
const utils_1 = require("../utils");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_ACCOUNT"] = "WITH_ACCOUNT";
    ScopeNames["WITH_SERVER"] = "WITH_SERVER";
})(ScopeNames || (ScopeNames = {}));
let ServerBlocklistModel = ServerBlocklistModel_1 = class ServerBlocklistModel extends sequelize_typescript_1.Model {
    static loadByAccountAndHost(accountId, host) {
        const query = {
            where: {
                accountId
            },
            include: [
                {
                    model: server_1.ServerModel,
                    where: {
                        host
                    },
                    required: true
                }
            ]
        };
        return ServerBlocklistModel_1.findOne(query);
    }
    static listForApi(accountId, start, count, sort) {
        const query = {
            offset: start,
            limit: count,
            order: utils_1.getSort(sort),
            where: {
                accountId
            }
        };
        return ServerBlocklistModel_1
            .scope([ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_SERVER])
            .findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    toFormattedJSON() {
        return {
            byAccount: this.ByAccount.toFormattedJSON(),
            blockedServer: this.BlockedServer.toFormattedJSON(),
            createdAt: this.createdAt
        };
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], ServerBlocklistModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], ServerBlocklistModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ServerBlocklistModel.prototype, "accountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            name: 'accountId',
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", account_1.AccountModel)
], ServerBlocklistModel.prototype, "ByAccount", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => server_1.ServerModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ServerBlocklistModel.prototype, "targetServerId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => server_1.ServerModel, {
        foreignKey: {
            name: 'targetServerId',
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", server_1.ServerModel)
], ServerBlocklistModel.prototype, "BlockedServer", void 0);
ServerBlocklistModel = ServerBlocklistModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_ACCOUNT]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    required: true
                }
            ]
        },
        [ScopeNames.WITH_SERVER]: {
            include: [
                {
                    model: () => server_1.ServerModel,
                    required: true
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'serverBlocklist',
        indexes: [
            {
                fields: ['accountId', 'targetServerId'],
                unique: true
            },
            {
                fields: ['targetServerId']
            }
        ]
    })
], ServerBlocklistModel);
exports.ServerBlocklistModel = ServerBlocklistModel;
//# sourceMappingURL=server-blocklist.js.map