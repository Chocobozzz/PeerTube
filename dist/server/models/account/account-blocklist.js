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
var AccountBlocklistModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const account_1 = require("./account");
const utils_1 = require("../utils");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_ACCOUNTS"] = "WITH_ACCOUNTS";
})(ScopeNames || (ScopeNames = {}));
let AccountBlocklistModel = AccountBlocklistModel_1 = class AccountBlocklistModel extends sequelize_typescript_1.Model {
    static loadByAccountAndTarget(accountId, targetAccountId) {
        const query = {
            where: {
                accountId,
                targetAccountId
            }
        };
        return AccountBlocklistModel_1.findOne(query);
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
        return AccountBlocklistModel_1
            .scope([ScopeNames.WITH_ACCOUNTS])
            .findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    toFormattedJSON() {
        return {
            byAccount: this.ByAccount.toFormattedJSON(),
            blockedAccount: this.BlockedAccount.toFormattedJSON(),
            createdAt: this.createdAt
        };
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], AccountBlocklistModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], AccountBlocklistModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], AccountBlocklistModel.prototype, "accountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            name: 'accountId',
            allowNull: false
        },
        as: 'ByAccount',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", account_1.AccountModel)
], AccountBlocklistModel.prototype, "ByAccount", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], AccountBlocklistModel.prototype, "targetAccountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            name: 'targetAccountId',
            allowNull: false
        },
        as: 'BlockedAccount',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", account_1.AccountModel)
], AccountBlocklistModel.prototype, "BlockedAccount", void 0);
AccountBlocklistModel = AccountBlocklistModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_ACCOUNTS]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    required: true,
                    as: 'ByAccount'
                },
                {
                    model: () => account_1.AccountModel,
                    required: true,
                    as: 'BlockedAccount'
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'accountBlocklist',
        indexes: [
            {
                fields: ['accountId', 'targetAccountId'],
                unique: true
            },
            {
                fields: ['targetAccountId']
            }
        ]
    })
], AccountBlocklistModel);
exports.AccountBlocklistModel = AccountBlocklistModel;
//# sourceMappingURL=account-blocklist.js.map