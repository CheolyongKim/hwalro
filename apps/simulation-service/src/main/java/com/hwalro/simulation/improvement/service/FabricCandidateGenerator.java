package com.hwalro.simulation.improvement.service;

import com.hwalro.simulation.improvement.domain.FabricChange;
import com.hwalro.simulation.improvement.domain.FabricState;
import com.hwalro.simulation.improvement.domain.ProposalCandidate;
import java.util.ArrayList;
import java.util.List;

/**
 * 정해진 이동·회전 규칙만으로 fabric 변경 후보를 생성합니다.
 *
 * <p>후보의 적합성은 이 클래스가 아니라 제약 검사 단계에서 판단합니다.
 */
public final class FabricCandidateGenerator {
    private static final double MOVE_STEP_METERS = 0.5;
    private static final double MAX_MOVE_METERS = 2.0;
    private static final int ROTATION_STEP_DEGREES = 30;

    /** 한 시설물에 가능한 모든 단일 변경 후보를 생성합니다. */
    public List<ProposalCandidate> generateSingleChanges(FabricState fabric) {
        List<ProposalCandidate> candidates = new ArrayList<>();
        for (double distance = MOVE_STEP_METERS; distance <= MAX_MOVE_METERS; distance += MOVE_STEP_METERS) {
            addMoveCandidates(fabric, distance, candidates);
        }
        for (int degrees = ROTATION_STEP_DEGREES; degrees < 360; degrees += ROTATION_STEP_DEGREES) {
            candidates.add(new ProposalCandidate(List.of(new FabricChange(
                    fabric.id(), fabric.bounds(), fabric.bounds().rotateClockwiseBy(degrees)))));
        }
        return candidates;
    }

    /** 기존 후보에 아직 변경하지 않은 시설물 하나를 추가합니다. */
    public List<ProposalCandidate> addSecondChanges(ProposalCandidate base, List<FabricState> fabrics) {
        List<ProposalCandidate> candidates = new ArrayList<>();
        for (FabricState fabric : fabrics) {
            if (base.changesFabric(fabric.id())) {
                continue;
            }
            for (ProposalCandidate single : generateSingleChanges(fabric)) {
                List<FabricChange> changes = new ArrayList<>(base.changes());
                changes.add(single.changes().get(0));
                candidates.add(new ProposalCandidate(changes));
            }
        }
        return candidates;
    }

    private void addMoveCandidates(FabricState fabric, double distance, List<ProposalCandidate> candidates) {
        addMoveCandidate(fabric, distance, 0, candidates);
        addMoveCandidate(fabric, -distance, 0, candidates);
        addMoveCandidate(fabric, 0, distance, candidates);
        addMoveCandidate(fabric, 0, -distance, candidates);
    }

    private void addMoveCandidate(
            FabricState fabric, double deltaX, double deltaY, List<ProposalCandidate> candidates) {
        for (int degrees = 0; degrees < 360; degrees += ROTATION_STEP_DEGREES) {
            // Zero degrees preserves a move-only candidate; the remaining values combine movement and rotation.
            candidates.add(new ProposalCandidate(List.of(new FabricChange(
                    fabric.id(),
                    fabric.bounds(),
                    fabric.bounds().moveBy(deltaX, deltaY).rotateClockwiseBy(degrees)))));
        }
    }
}
