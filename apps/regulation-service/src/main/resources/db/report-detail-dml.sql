-- 보고서 상세·편집 API 확인용 수동 DML이다. 자동 실행하지 않는다.
-- author_id=2인 OPERATOR 계정 또는 SAFETY_REVIEWER 계정으로 API를 호출해 확인한다.

USE hwalro_regulation;

INSERT INTO reports (id, author_id, title, content, status, created_at, updated_at) VALUES
    (101, 2, 'B2 팝업 안전 검토 보고서',
     '{"overview":"더현대 서울 B2 팝업 배치 변경에 따른 대피 안전성을 검토하였다.","analysis":"개선 배치 B의 총 대피 시간은 264초로 배치 A보다 38초 단축되었다.","improvements":"팝업 가벽 2m 이동과 서측 안내 동선 분산을 권고한다."}',
     '작성 중', NOW(6), NOW(6)),
    (102, 2, 'AI 생성 안전 검토 초안',
     '{"overview":"AI가 시뮬레이션 결과를 바탕으로 생성한 초안입니다.","analysis":"중앙 통로의 밀집도 개선이 필요합니다.","improvements":"현장 재점검을 권고합니다."}',
     '초안', NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), content = VALUES(content), status = VALUES(status), updated_at = NOW(6);

INSERT IGNORE INTO report_simulations (report_id, simulation_result_id) VALUES
    (101, 18), (101, 14), (102, 18);

-- GET /api/reports/102를 호출하면 상태가 초안에서 작성 중으로 전환된다.
-- GET /api/reports/101로 조회 후 아래 형식으로 PUT /api/reports/101 요청을 보낸다.
-- {"title":"B2 팝업 안전 검토 보고서 수정","content":{"overview":"수정된 개요","analysis":"수정된 분석 결과","improvements":"수정된 개선 조치"},"status":"완료"}
