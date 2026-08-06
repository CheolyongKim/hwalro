package com.hwalro.simulation.improvement.domain;

/** 후보 배치에서 측정한 비공식 개선 근거입니다. */
public record ProposalEvaluation(
        ProposalCandidate candidate,
        double bottleneckWidthIncrease,
        double exitPathWidthIncrease,
        double heatmapOverlapDecrease) {}
