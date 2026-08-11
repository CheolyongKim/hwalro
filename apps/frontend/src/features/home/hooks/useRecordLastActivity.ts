import { useEffect } from 'react';
import { homeApi } from '../api/homeApi';
import type { LastActivityType } from '../types/home';

/**
 * 현재 화면을 사용자의 마지막 작업으로 기록한다.
 * 홈 화면의 "검토 이어가기"를 위한 부가 기능이므로 실패해도 화면을 막지 않는다.
 */
export function useRecordLastActivity(
  activityType: LastActivityType,
  resourceId: number | null | undefined,
): void {
  useEffect(() => {
    if (resourceId == null || Number.isNaN(resourceId)) return;
    void homeApi.recordLastActivity(activityType, resourceId).catch(() => undefined);
  }, [activityType, resourceId]);
}
