import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RefreshTokenPayload } from '@en/common/user';

export const CurrentUser = createParamDecorator(
  (
    data: keyof RefreshTokenPayload | undefined,
    ctx: ExecutionContext,
  ): RefreshTokenPayload | RefreshTokenPayload[keyof RefreshTokenPayload] => {
    const request = ctx.switchToHttp().getRequest<{
      user?: RefreshTokenPayload;
    }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
