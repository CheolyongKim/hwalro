package com.hwalro.regulation.report;

import java.util.Arrays;

/** reports.status에 저장되는 화면 표시용 상태값을 제한한다. */
public enum ReportStatus {
    DRAFT("초안"),
    IN_PROGRESS("작성 중"),
    COMPLETED("완료");

    private final String value;

    ReportStatus(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static String validate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return Arrays.stream(values())
                .map(ReportStatus::value)
                .filter(value::equals)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("status must be one of: 초안, 작성 중, 완료."));
    }
}
