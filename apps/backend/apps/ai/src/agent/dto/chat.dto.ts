import {
  CHAT_ATTACHMENT_IDS_MAX,
  CHAT_CONTENT_MAX_LENGTH,
  CHAT_ID_MAX_LENGTH,
  type ChatRequestDto as ChatRequestDtoType,
} from '@en/common/chat';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimStringArray({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) =>
    typeof item === 'string' ? item.trim() : item,
  );
}

/** POST /chat 请求体运行时校验（userId 由 JWT 注入，不接受客户端传入） */
export class ChatRequestDto implements ChatRequestDtoType {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'assistantKey 不能为空' })
  @IsUUID('4', { message: 'assistantKey 必须是合法 UUID' })
  assistantKey!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'conversationId 不能为空' })
  @IsUUID('4', { message: 'conversationId 必须是合法 UUID' })
  conversationId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  @MaxLength(CHAT_CONTENT_MAX_LENGTH, {
    message: `content 不能超过 ${CHAT_CONTENT_MAX_LENGTH} 个字符`,
  })
  content!: string;

  @IsOptional()
  @Transform(trimStringArray)
  @IsArray({ message: 'attachmentIds 必须是数组' })
  @ArrayMaxSize(CHAT_ATTACHMENT_IDS_MAX, {
    message: `attachmentIds 最多 ${CHAT_ATTACHMENT_IDS_MAX} 个`,
  })
  @ArrayUnique({ message: 'attachmentIds 不能包含重复项' })
  @IsString({ each: true, message: 'attachmentIds 每一项必须是字符串' })
  @IsNotEmpty({ each: true, message: 'attachmentIds 不能包含空字符串' })
  @MaxLength(CHAT_ID_MAX_LENGTH, {
    each: true,
    message: `attachmentIds 每一项不能超过 ${CHAT_ID_MAX_LENGTH} 个字符`,
  })
  attachmentIds?: string[];
}
