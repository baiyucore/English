import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { MetricsRange } from '@en/common/metrics';
import { AuthGuard, CurrentUser } from '@libs/shared';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('overview')
  overview(
    @Query('range') range?: MetricsRange,
    @Query('keyword') keyword?: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.metricsService.getOverview({ range, userId, keyword });
  }
}
