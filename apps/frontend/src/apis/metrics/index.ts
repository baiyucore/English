import { aiApi, type Response } from '..';
import type {
  MetricsOverview,
  MetricsOverviewQuery,
} from '@en/common/metrics';

export const getMetricsOverview = (query: MetricsOverviewQuery = {}) => {
  const params = new URLSearchParams();
  if (query.range) params.set('range', query.range);
  if (query.userId?.trim()) params.set('userId', query.userId.trim());
  if (query.keyword?.trim()) params.set('keyword', query.keyword.trim());

  const qs = params.toString();
  return aiApi.get(`/metrics/overview${qs ? `?${qs}` : ''}`) as Promise<
    Response<MetricsOverview>
  >;
};
