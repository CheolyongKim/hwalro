package com.hwalro.simulation.search.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.simulation.search.domain.Metric;
import java.util.List;
import org.junit.jupiter.api.Test;

class CandidateSelectorTest {
    private static final double MARGIN = 0.02;

    private static List<Metric> metrics(double totalSeconds, double averageSeconds, double maxDensity) {
        return List.of(
                new Metric("TOTAL_EVACUATION_TIME_SECONDS", "seconds", totalSeconds),
                new Metric("AVERAGE_EVACUATION_TIME_SECONDS", "seconds", averageSeconds),
                new Metric("MAX_DENSITY", "PERSON_PER_M2", maxDensity));
    }

    @Test
    void a_candidate_that_only_shortens_the_average_still_counts_as_improved() {
        // 총 대피시간은 마지막 한 명이 나가는 시각이라, 출구를 모두 열고 인원을 고루 배치하면 가장 먼
        // 사람의 도보 시간이 값을 고정한다. 그 사람의 경로를 건드리지 않는 변경은 총 대피시간을 전혀
        // 바꾸지 못하면서 나머지 모두를 빠르게 만들 수 있다.
        List<Metric> baseline = metrics(59.6, 24.0, 4.0);
        List<Metric> trial = metrics(59.6, 22.0, 4.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isTrue();
    }

    @Test
    void a_candidate_that_only_shortens_the_total_still_counts_as_improved() {
        List<Metric> baseline = metrics(59.6, 24.0, 4.0);
        List<Metric> trial = metrics(55.0, 24.0, 4.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isTrue();
    }

    @Test
    void a_candidate_that_only_thins_out_the_worst_crowding_counts_as_improved() {
        // 탐색 4번 후보 19의 실측값이다. 총 대피시간은 소수점까지 그대로였고 평균은 0.79%만 줄었지만
        // 최대 밀집도가 4.0에서 3.0으로 내려갔다 - 그 후보가 겨냥한 BOTTLENECK 진단이 근거로 든 값이
        // 바로 그 밀집도(PEAK_DENSITY 4.0)였다.
        List<Metric> baseline = metrics(59.6, 24.0, 4.0);
        List<Metric> trial = metrics(59.6, 23.81, 3.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isTrue();
    }

    @Test
    void thinner_crowding_does_not_excuse_a_materially_slower_evacuation() {
        // 밀집도만 승인 사유로 두면 "덜 붐비지만 훨씬 느린" 배치가 통과한다. 사각지대 스윕에서
        // 실제로 그런 후보가 나왔다 - 밀집도 4.0→3.0인데 평균 대피시간은 늘었다.
        List<Metric> baseline = metrics(59.29, 22.92, 4.0);
        List<Metric> trial = metrics(70.0, 27.0, 3.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isFalse();
    }

    @Test
    void a_faster_layout_that_packs_people_tighter_is_not_an_improvement() {
        List<Metric> baseline = metrics(59.6, 24.0, 4.0);
        List<Metric> trial = metrics(59.6, 22.0, 5.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isFalse();
    }

    @Test
    void no_metric_clearing_the_margin_is_still_not_an_improvement() {
        // 탐색 3번의 실측값이다. 총 대피시간 -1.48%, 평균 -0.97%로 둘 다 2%에 못 미쳤고 밀집도는
        // 그대로였다. 평균과 밀집도를 판정에 넣어도 이 탐색의 결과는 바뀌지 않는다 - 이 변경이 그
        // 사례를 통과시킨다고 오해하지 않도록 실제 숫자로 못박는다.
        List<Metric> baseline = metrics(59.6, 23.90747, 4.0);
        List<Metric> trial = metrics(58.72, 23.67508, 4.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isFalse();
    }

    @Test
    void a_zero_baseline_never_counts_as_improved() {
        List<Metric> baseline = metrics(0.0, 0.0, 0.0);
        List<Metric> trial = metrics(0.0, 0.0, 0.0);

        assertThat(CandidateSelector.judge(trial, baseline, MARGIN).improved()).isFalse();
    }
}
