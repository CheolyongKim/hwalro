import { AxiosError } from 'axios';

export function getSimulationErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) {
      return message;
    }
    if (error.response?.status === 404) {
      return '시뮬레이션을 찾을 수 없습니다.';
    }
    if (error.response?.status === 409) {
      return '현재 상태에서는 시뮬레이션 설정을 변경할 수 없습니다.';
    }
    if (error.response?.status === 422) {
      return '도면 외곽선이 없거나 올바른 폐곡선이 아닙니다. 외곽선을 먼저 수정해 주세요.';
    }
  }
  return '요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
