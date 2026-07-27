import { Injectable } from '@nestjs/common';
import { ResponseService } from '@libs/shared';
import { chatMode } from './prompt.mode';

@Injectable()
export class PromptService {
  constructor(private readonly responseService: ResponseService) { }

  findAll() {
    return this.responseService.success(chatMode.map((item) => ({
      label: item.label,
      id: item.id,
      role: item.role,
    })));
  }
}
