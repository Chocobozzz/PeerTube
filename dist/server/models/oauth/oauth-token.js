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
var OAuthTokenModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const logger_1 = require("../../helpers/logger");
const user_1 = require("../account/user");
const oauth_client_1 = require("./oauth-client");
const account_1 = require("../account/account");
const actor_1 = require("../activitypub/actor");
const oauth_model_1 = require("../../lib/oauth-model");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_USER"] = "WITH_USER";
})(ScopeNames || (ScopeNames = {}));
let OAuthTokenModel = OAuthTokenModel_1 = class OAuthTokenModel extends sequelize_typescript_1.Model {
    static removeTokenCache(token) {
        return oauth_model_1.clearCacheByToken(token.accessToken);
    }
    static getByRefreshTokenAndPopulateClient(refreshToken) {
        const query = {
            where: {
                refreshToken: refreshToken
            },
            include: [oauth_client_1.OAuthClientModel]
        };
        return OAuthTokenModel_1.findOne(query)
            .then(token => {
            if (!token)
                return null;
            return {
                refreshToken: token.refreshToken,
                refreshTokenExpiresAt: token.refreshTokenExpiresAt,
                client: {
                    id: token.oAuthClientId
                },
                user: {
                    id: token.userId
                }
            };
        })
            .catch(err => {
            logger_1.logger.error('getRefreshToken error.', { err });
            throw err;
        });
    }
    static getByTokenAndPopulateUser(bearerToken) {
        const query = {
            where: {
                accessToken: bearerToken
            }
        };
        return OAuthTokenModel_1.scope(ScopeNames.WITH_USER).findOne(query).then(token => {
            if (token)
                token['user'] = token.User;
            return token;
        });
    }
    static getByRefreshTokenAndPopulateUser(refreshToken) {
        const query = {
            where: {
                refreshToken: refreshToken
            }
        };
        return OAuthTokenModel_1.scope(ScopeNames.WITH_USER)
            .findOne(query)
            .then(token => {
            if (token) {
                token['user'] = token.User;
                return token;
            }
            else {
                return new OAuthTokenModel_1();
            }
        });
    }
    static deleteUserToken(userId, t) {
        const query = {
            where: {
                userId
            },
            transaction: t
        };
        return OAuthTokenModel_1.destroy(query);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], OAuthTokenModel.prototype, "accessToken", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Date)
], OAuthTokenModel.prototype, "accessTokenExpiresAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], OAuthTokenModel.prototype, "refreshToken", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Date)
], OAuthTokenModel.prototype, "refreshTokenExpiresAt", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], OAuthTokenModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], OAuthTokenModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => user_1.UserModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], OAuthTokenModel.prototype, "userId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => user_1.UserModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", user_1.UserModel)
], OAuthTokenModel.prototype, "User", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => oauth_client_1.OAuthClientModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], OAuthTokenModel.prototype, "oAuthClientId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => oauth_client_1.OAuthClientModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], OAuthTokenModel.prototype, "OAuthClients", void 0);
__decorate([
    sequelize_typescript_1.AfterUpdate,
    sequelize_typescript_1.AfterDelete,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OAuthTokenModel]),
    __metadata("design:returntype", void 0)
], OAuthTokenModel, "removeTokenCache", null);
OAuthTokenModel = OAuthTokenModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_USER]: {
            include: [
                {
                    model: () => user_1.UserModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: ['id'],
                            model: () => account_1.AccountModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    attributes: ['id'],
                                    model: () => actor_1.ActorModel.unscoped(),
                                    required: true
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'oAuthToken',
        indexes: [
            {
                fields: ['refreshToken'],
                unique: true
            },
            {
                fields: ['accessToken'],
                unique: true
            },
            {
                fields: ['userId']
            },
            {
                fields: ['oAuthClientId']
            }
        ]
    })
], OAuthTokenModel);
exports.OAuthTokenModel = OAuthTokenModel;
//# sourceMappingURL=oauth-token.js.map