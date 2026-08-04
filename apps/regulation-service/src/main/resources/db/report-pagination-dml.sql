-- 보고서 목록 페이징 확인용 수동 DML이다. 자동 실행하지 않는다.
-- 301~315번 보고서가 추가되며, 목록의 5건 단위 및 5페이지 그룹 이동을 확인할 수 있다.

USE hwalro_regulation;

INSERT INTO reports (id, author_id, title, content, status, created_at, updated_at) VALUES
    (301, 2, '팝업스토어 입구 혼잡도 검토 보고서', JSON_OBJECT('overview', '입구 대기 동선을 검토하였다.', 'analysis', '혼잡 시간대 안내 인력 배치가 필요하다.', 'improvements', '입구 대기선을 외곽으로 이동한다.'), '작성 중', NOW(6) - INTERVAL 1 DAY, NOW(6) - INTERVAL 1 DAY),
    (302, 3, '전시장 비상 출구 표지 점검 보고서', JSON_OBJECT('overview', '비상 출구 표지 상태를 점검하였다.', 'analysis', '후면 출구 표지의 시인성이 낮다.', 'improvements', '조도와 표지 크기를 보강한다.'), '완료', NOW(6) - INTERVAL 2 DAY, NOW(6) - INTERVAL 2 DAY),
    (303, 2, '체험존 대피 유도선 검토 보고서', JSON_OBJECT('overview', '체험존 대피 유도선을 검토하였다.', 'analysis', '보조 동선 유도가 필요하다.', 'improvements', '바닥 유도선을 추가한다.'), '초안', NOW(6) - INTERVAL 3 DAY, NOW(6) - INTERVAL 3 DAY),
    (304, 3, '행사장 계산대 대기열 분석 보고서', JSON_OBJECT('overview', '계산대 대기열 배치를 분석하였다.', 'analysis', '주 통로 침범 가능성이 있다.', 'improvements', '대기줄 시작 위치를 변경한다.'), '작성 중', NOW(6) - INTERVAL 4 DAY, NOW(6) - INTERVAL 4 DAY),
    (305, 2, '로비 안내 데스크 배치 검토 보고서', JSON_OBJECT('overview', '로비 안내 데스크 위치를 검토하였다.', 'analysis', '입구 시야 확보가 필요하다.', 'improvements', '안내 데스크를 우측으로 이동한다.'), '완료', NOW(6) - INTERVAL 5 DAY, NOW(6) - INTERVAL 5 DAY),
    (306, 3, '야외 행사장 우천 대피 동선 보고서', JSON_OBJECT('overview', '우천 시 대피 동선을 검토하였다.', 'analysis', '천막 구역에 병목이 예상된다.', 'improvements', '보조 출입구를 개방한다.'), '초안', NOW(6) - INTERVAL 6 DAY, NOW(6) - INTERVAL 6 DAY),
    (307, 2, '공연장 측면 통로 안전 검토 보고서', JSON_OBJECT('overview', '측면 통로의 안전성을 검토하였다.', 'analysis', '적치물 제거가 필요하다.', 'improvements', '통로 적치물 관리 기준을 적용한다.'), '작성 중', NOW(6) - INTERVAL 7 DAY, NOW(6) - INTERVAL 7 DAY),
    (308, 3, '문화행사 출입구 분산 운영 보고서', JSON_OBJECT('overview', '출입구 분산 운영안을 검토하였다.', 'analysis', '입장 시간 분산 효과가 확인되었다.', 'improvements', '시간대별 입장 안내를 운영한다.'), '완료', NOW(6) - INTERVAL 8 DAY, NOW(6) - INTERVAL 8 DAY),
    (309, 2, '임시 판매 공간 통로 폭 검토 보고서', JSON_OBJECT('overview', '임시 판매 공간 통로 폭을 검토하였다.', 'analysis', '중앙 구간 확장이 필요하다.', 'improvements', '진열대를 0.5m 후퇴한다.'), '초안', NOW(6) - INTERVAL 9 DAY, NOW(6) - INTERVAL 9 DAY),
    (310, 3, '행사장 비상 방송 전달성 보고서', JSON_OBJECT('overview', '비상 방송 전달성을 점검하였다.', 'analysis', '후면 구역 음량이 부족하다.', 'improvements', '보조 스피커를 설치한다.'), '작성 중', NOW(6) - INTERVAL 10 DAY, NOW(6) - INTERVAL 10 DAY),
    (311, 2, '전시장 휴게 공간 배치 검토 보고서', JSON_OBJECT('overview', '휴게 공간 배치를 검토하였다.', 'analysis', '대피 동선과 분리가 필요하다.', 'improvements', '휴게 좌석을 외곽으로 재배치한다.'), '완료', NOW(6) - INTERVAL 11 DAY, NOW(6) - INTERVAL 11 DAY),
    (312, 3, '팝업 굿즈존 출구 동선 보고서', JSON_OBJECT('overview', '굿즈존 출구 동선을 검토하였다.', 'analysis', '출구 교차가 발생한다.', 'improvements', '굿즈존 대기 방향을 변경한다.'), '초안', NOW(6) - INTERVAL 12 DAY, NOW(6) - INTERVAL 12 DAY),
    (313, 2, '지하 공간 비상 조명 점검 보고서', JSON_OBJECT('overview', '지하 공간 비상 조명을 점검하였다.', 'analysis', '일부 구역 조도 보강이 필요하다.', 'improvements', '비상등 추가 설치를 권고한다.'), '작성 중', NOW(6) - INTERVAL 13 DAY, NOW(6) - INTERVAL 13 DAY),
    (314, 3, '브랜드 체험관 출입 통제 보고서', JSON_OBJECT('overview', '체험관 출입 통제를 검토하였다.', 'analysis', '대기 인원 상한 관리가 필요하다.', 'improvements', '입장 인원 카운터를 운영한다.'), '완료', NOW(6) - INTERVAL 14 DAY, NOW(6) - INTERVAL 14 DAY),
    (315, 2, '주말 행사장 안내 표지 검토 보고서', JSON_OBJECT('overview', '안내 표지 배치를 검토하였다.', 'analysis', '교차로 표지 추가가 필요하다.', 'improvements', '방향 표지를 증설한다.'), '초안', NOW(6) - INTERVAL 15 DAY, NOW(6) - INTERVAL 15 DAY)
ON DUPLICATE KEY UPDATE
    author_id = VALUES(author_id),
    title = VALUES(title),
    content = VALUES(content),
    status = VALUES(status),
    updated_at = VALUES(updated_at);

SELECT id, author_id, title, status, updated_at
FROM reports
WHERE id BETWEEN 301 AND 315
ORDER BY updated_at DESC;
