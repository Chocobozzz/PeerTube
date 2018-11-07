"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_right_enum_1 = require("./user-right.enum");
var UserRole;
(function (UserRole) {
    UserRole[UserRole["ADMINISTRATOR"] = 0] = "ADMINISTRATOR";
    UserRole[UserRole["MODERATOR"] = 1] = "MODERATOR";
    UserRole[UserRole["USER"] = 2] = "USER";
})(UserRole = exports.UserRole || (exports.UserRole = {}));
exports.USER_ROLE_LABELS = {
    [UserRole.USER]: 'UserToto',
    [UserRole.MODERATOR]: 'Moderator',
    [UserRole.ADMINISTRATOR]: 'Administrator'
};
const userRoleRights = {
    [UserRole.ADMINISTRATOR]: [
        user_right_enum_1.UserRight.ALL
    ],
    [UserRole.MODERATOR]: [
        user_right_enum_1.UserRight.MANAGE_VIDEO_BLACKLIST,
        user_right_enum_1.UserRight.MANAGE_VIDEO_ABUSES,
        user_right_enum_1.UserRight.REMOVE_ANY_VIDEO,
        user_right_enum_1.UserRight.REMOVE_ANY_VIDEO_CHANNEL,
        user_right_enum_1.UserRight.REMOVE_ANY_VIDEO_COMMENT,
        user_right_enum_1.UserRight.UPDATE_ANY_VIDEO,
        user_right_enum_1.UserRight.SEE_ALL_VIDEOS,
        user_right_enum_1.UserRight.MANAGE_ACCOUNTS_BLOCKLIST,
        user_right_enum_1.UserRight.MANAGE_SERVERS_BLOCKLIST
    ],
    [UserRole.USER]: [],
};
function hasUserRight(userRole, userRight) {
    const userRights = userRoleRights[userRole];
    return userRights.indexOf(user_right_enum_1.UserRight.ALL) !== -1 || userRights.indexOf(userRight) !== -1;
}
exports.hasUserRight = hasUserRight;
//# sourceMappingURL=user-role.js.map