package com.hwalro.regulation.report.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.regulation.report.client.SimulationReportContextClient.Bottleneck;
import com.hwalro.regulation.report.client.SimulationReportContextClient.Context;
import com.hwalro.regulation.report.client.SimulationReportContextClient.Metric;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReportPromptFactoryTest {
    @Test
    void localizesMetricLabelsAndUnitsWhilePreservingOfficialValues() {
        Context source = new Context(
                10L,
                100L,
                "현재 배치안",
                List.of(
                        new Metric("TOTAL_EVACUATION_TIME", 264, "SECOND"),
                        new Metric("MAX_DENSITY", 4.8, "PERSON_PER_M2"),
                        new Metric("TOTAL_PEOPLE", 100, "PERSON"),
                        new Metric("EVACUATED_PEOPLE", 100, "PERSON"),
                        new Metric("BOTTLENECK_COUNT", 2, "COUNT")),
                List.of(new Bottleneck(1, 12, 72, 4.8, 3.5)));
        Context comparison =
                new Context(20L, 200L, "중앙 통로 확장안", List.of(new Metric("TOTAL_EVACUATION_TIME", 302, "s")), List.of());
        ReportDraftInput input = new ReportDraftInput(
                source,
                List.of(comparison),
                List.of(new ReportDraftInput.Risk(10L, "무대 전면 위험 예상 구역", "사용자 지정", "HIGH")));

        ReportPromptFactory.Prompt prompt = new ReportPromptFactory().create(input);

        assertThat(prompt.system())
                .contains("쉬운 한국어", "영문 지표 코드", "공식 지표를 계산", "추정하지")
                .doesNotContain("전문 용어를 적극적으로 사용");
        assertThat(prompt.user())
                .contains(
                        "[현재안]",
                        "현재 배치안",
                        "총 대피 시간: 264.0 초",
                        "최대 밀집도: 4.8 명/㎡",
                        "총인원: 100.0 명",
                        "대피 완료 인원: 100.0 명",
                        "병목 구간 수: 2.0 곳",
                        "병목 1: 12.0초~72.0초",
                        "[비교안 1]",
                        "중앙 통로 확장안",
                        "총 대피 시간: 302.0 초",
                        "무대 전면 위험 예상 구역",
                        "위험도 높음")
                .doesNotContain(
                        "TOTAL_EVACUATION_TIME",
                        "MAX_DENSITY",
                        "TOTAL_PEOPLE",
                        "EVACUATED_PEOPLE",
                        "BOTTLENECK_COUNT",
                        "PERSON_PER_M2",
                        "HIGH");
    }

    @Test
    void preservesUnknownMetricAndUnitCodes() {
        Context source = new Context(10L, 100L, "현재 배치안", List.of(new Metric("NEW_METRIC", 7, "NEW_UNIT")), List.of());

        ReportPromptFactory.Prompt prompt =
                new ReportPromptFactory().create(new ReportDraftInput(source, List.of(), List.of()));

        assertThat(prompt.user()).contains("NEW_METRIC: 7.0 NEW_UNIT");
    }
}
