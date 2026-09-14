import type { FocusDashboardMetrics } from '../../shared/domain'
import type { FocusSessionRepository } from './FocusSessionRepository'

export class FocusDashboardService {
  constructor(
    private readonly sessionRepository: FocusSessionRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  getMetrics(days: 7 | 30 = 30): FocusDashboardMetrics {
    return this.sessionRepository.getDashboardMetrics(days, this.clock())
  }
}
