import { Controller, Get, Query } from '@nestjs/common';
import type { MetricsRange } from '@en/common/metrics';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('overview')
  overview(
    @Query('range') range?: MetricsRange,
    @Query('userId') userId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.metricsService.getOverview({ range, userId, keyword });
  }
}
