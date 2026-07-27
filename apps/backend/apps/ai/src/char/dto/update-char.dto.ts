import { PartialType } from '@nestjs/mapped-types';
import { CreateCharDto } from './create-char.dto';

export class UpdateCharDto extends PartialType(CreateCharDto) {}
