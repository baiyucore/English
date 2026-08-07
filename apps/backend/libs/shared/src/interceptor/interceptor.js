"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterceptorInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const transformBigInt = (obj) => {
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(transformBigInt);
    }
    if (obj !== null && typeof obj === 'object') {
        if (obj instanceof Date) {
            return obj;
        }
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, transformBigInt(value)]));
    }
    return obj;
};
let InterceptorInterceptor = class InterceptorInterceptor {
    intercept(context, next) {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        return next.handle().pipe((0, rxjs_1.map)((data) => {
            const code = data?.code || 200;
            return {
                timestamp: new Date().toISOString(),
                path: request.url,
                message: data?.message || '请求成功',
                code,
                success: code === 200,
                data: transformBigInt(data?.data) ?? null,
            };
        }));
    }
};
exports.InterceptorInterceptor = InterceptorInterceptor;
exports.InterceptorInterceptor = InterceptorInterceptor = __decorate([
    (0, common_1.Injectable)()
], InterceptorInterceptor);
//# sourceMappingURL=interceptor.js.map