import { Injectable } from '@nestjs/common';
import type {
  UserLogin,
  UserRegister,
  Token,
  RefreshTokenPayload,
} from '@en/common/user';
import { PrismaService, ResponseService } from '@libs/shared';
import type { Prisma } from '@libs/shared/generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { MinioService } from '@libs/shared/minio/minio.service';
import { ConfigService } from '@nestjs/config';
const selectUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  wordNumber: true,
  dayNumber: true,
  avatar: true,
  address: true,
  bio: true,
  isTimingTask: true,
  timingTaskTime: true,
};
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly responseService: ResponseService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}
  //登录
  async login(createUserDto: UserLogin) {
    const user = await this.prisma.user.findUnique({
      where: {
        phone: createUserDto.phone,
      },
    });
    if (!user) {
      return this.responseService.error(null, '用户不存在');
    }
    if (user.password !== createUserDto.password) {
      return this.responseService.error(null, '密码错误');
    }
    const updateUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: selectUser,
    });
    const token = this.authService.generateToken({
      userId: updateUser.id,
      name: updateUser.name,
      email: updateUser.email,
    });
    return this.responseService.success({ ...updateUser, token });
  }

  //注册
  async register(createUserDto: UserRegister) {
    const data: Prisma.UserCreateInput = {
      phone: createUserDto.phone,
      password: createUserDto.password,
      name: createUserDto.name,
      lastLoginAt: new Date(),
    };

    const user = await this.prisma.user.findUnique({
      where: {
        phone: createUserDto.phone,
      },
    });
    if (user) {
      return this.responseService.error(null, '用户已存在');
    }
    if (createUserDto.email) {
      const emailUser = await this.prisma.user.findUnique({
        where: {
          email: createUserDto.email,
        },
      });
      if (emailUser) {
        return this.responseService.error(null, '邮箱已存在');
      }
      data.email = createUserDto.email;
    }

    const newUser = await this.prisma.user.create({
      data,
      select: selectUser,
    });
    const token = this.authService.generateToken({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });
    return this.responseService.success({ ...newUser, token });
  }

  async refreshToken(createUserDto: Omit<Token, 'accessToken'>) {
    try {
      const decoded = this.jwtService.verify<RefreshTokenPayload>(
        createUserDto.refreshToken,
      ) as RefreshTokenPayload;
      if (decoded.tokenType !== 'refresh') {
        return this.responseService.error(null, '无效的刷新令牌');
      }
      const user = await this.prisma.user.findUnique({
        where: {
          id: decoded.userId,
        },
      });
      if (!user) {
        return this.responseService.error(null, '用户不存在');
      }
      const token = this.authService.generateToken({
        userId: user.id,
        name: user.name,
        email: user.email,
      });
      return this.responseService.success(token);
    } catch {
      return this.responseService.error(null, '无效的刷新令牌');
    }
  }

  async uploadAvatar(file: Express.Multer.File) {
    if (!file) {
      return this.responseService.error(null, '文件不存在');
    }

    if (file.size > 1024 * 1024 * 5) {
      return this.responseService.error(null, '文件大小超过5MB');
    }
    if (!file.mimetype.includes('image')) {
      return this.responseService.error(null, '文件类型不支持');
    }
    const fileName = `${Date.now()}-${file.originalname}`;
    const bucket = this.minioService.getBucket();
    const client = this.minioService.getClient();
    await client.putObject(bucket, fileName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    const isHttps = !!Number(this.configService.get('MINIO_USE_SSL'));
    const baseUrl = isHttps ? 'https' : 'http';
    const port = this.configService.get('MINIO_PORT');
    const databaseUrl = `/${bucket}/${fileName}`;
    const previewUrl = `${baseUrl}://${this.configService.get('MINIO_ENDPOINT')}:${port}${databaseUrl}`;
    return this.responseService.success({ previewUrl, databaseUrl });
  }
}
