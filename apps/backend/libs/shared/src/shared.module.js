'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return (c > 3 && r && Object.defineProperty(target, key, r), r);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.SharedModule = void 0;
const common_1 = require('@nestjs/common');
const shared_service_1 = require('./shared.service');
const prisma_module_1 = require('./prisma/prisma.module');
const response_module_1 = require('./response/response.module');
const jwt_1 = require('@nestjs/jwt');
const config_1 = require('@nestjs/config');
const minio_module_1 = require('./minio/minio.module');
let SharedModule = class SharedModule {};
exports.SharedModule = SharedModule;
exports.SharedModule = SharedModule = __decorate(
  [
    (0, common_1.Global)(),
    (0, common_1.Module)({
      providers: [shared_service_1.SharedService],
      exports: [
        shared_service_1.SharedService,
        prisma_module_1.PrismaModule,
        response_module_1.ResponseModule,
        jwt_1.JwtModule,
        config_1.ConfigModule,
        minio_module_1.MinioModule,
      ],
      imports: [
        prisma_module_1.PrismaModule,
        response_module_1.ResponseModule,
        config_1.ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        jwt_1.JwtModule.registerAsync({
          imports: [config_1.ConfigModule],
          inject: [config_1.ConfigService],
          useFactory: (configService) => ({
            secret: configService.get('SECRET_KEY'),
            signOptions: { expiresIn: '2h' },
          }),
        }),
        minio_module_1.MinioModule,
      ],
    }),
  ],
  SharedModule,
);
//# sourceMappingURL=shared.module.js.map
