import { Module } from '@nestjs/common';
import { CharService } from './char.service';
import { CharController } from './char.controller';

@Module({
  controllers: [CharController],
  providers: [CharService],
})
export class CharModule {}
