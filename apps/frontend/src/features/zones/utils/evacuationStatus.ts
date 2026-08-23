import type { EvacuationStatus } from '../api/zoneApi';

export interface StatusPresentation {
  /** 화면에 그대로 쓰는 안내 문구. */
  message: string;
  tone: 'ok' | 'warning' | 'muted';
  /** 경로선을 그릴 수 있는 상태인가. */
  hasRoute: boolean;
}

export function evacuationStatusPresentation(status: EvacuationStatus): StatusPresentation {
  switch (status) {
    case 'AVAILABLE':
      return { message: '대피 경로를 안내합니다.', tone: 'ok', hasRoute: true };
    case 'NOT_CONFIGURED':
      return {
        message: '이 구역에는 대피 비상구가 아직 지정되지 않았습니다. 안전 담당자에게 문의하세요.',
        tone: 'muted',
        hasRoute: false,
      };
    case 'UNREACHABLE':
      return {
        message: '지정된 비상구까지의 경로를 찾을 수 없습니다. 안전 담당자에게 문의하세요.',
        tone: 'warning',
        hasRoute: false,
      };
  }
}
