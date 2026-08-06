package com.hwalro.simulation.drawing.dto;

import java.util.List;

public record DrawingUpdateRequest(
        String title,
        String description,
        List<WallDto> walls,
        List<PillarDto> pillars,
        List<FabricDto> fabrics,
        List<LayoutTextDto> layoutTexts,
        Integer expectedVersion) {}
