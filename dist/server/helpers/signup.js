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
const initializers_1 = require("../initializers");
const user_1 = require("../models/account/user");
const ipaddr = require("ipaddr.js");
const isCidr = require('is-cidr');
function isSignupAllowed() {
    return __awaiter(this, void 0, void 0, function* () {
        if (initializers_1.CONFIG.SIGNUP.ENABLED === false) {
            return false;
        }
        if (initializers_1.CONFIG.SIGNUP.LIMIT === -1) {
            return true;
        }
        const totalUsers = yield user_1.UserModel.countTotal();
        return totalUsers < initializers_1.CONFIG.SIGNUP.LIMIT;
    });
}
exports.isSignupAllowed = isSignupAllowed;
function isSignupAllowedForCurrentIP(ip) {
    const addr = ipaddr.parse(ip);
    let excludeList = ['blacklist'];
    let matched = '';
    if (initializers_1.CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr(cidr)).length > 0) {
        excludeList.push('unknown');
    }
    if (addr.kind() === 'ipv4') {
        const addrV4 = ipaddr.IPv4.parse(ip);
        const rangeList = {
            whitelist: initializers_1.CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v4(cidr))
                .map(cidr => ipaddr.IPv4.parseCIDR(cidr)),
            blacklist: initializers_1.CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v4(cidr))
                .map(cidr => ipaddr.IPv4.parseCIDR(cidr))
        };
        matched = ipaddr.subnetMatch(addrV4, rangeList, 'unknown');
    }
    else if (addr.kind() === 'ipv6') {
        const addrV6 = ipaddr.IPv6.parse(ip);
        const rangeList = {
            whitelist: initializers_1.CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v6(cidr))
                .map(cidr => ipaddr.IPv6.parseCIDR(cidr)),
            blacklist: initializers_1.CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v6(cidr))
                .map(cidr => ipaddr.IPv6.parseCIDR(cidr))
        };
        matched = ipaddr.subnetMatch(addrV6, rangeList, 'unknown');
    }
    return !excludeList.includes(matched);
}
exports.isSignupAllowedForCurrentIP = isSignupAllowedForCurrentIP;
//# sourceMappingURL=signup.js.map