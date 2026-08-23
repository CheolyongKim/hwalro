package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.domain.LayoutZoneStructure;
import com.hwalro.simulation.zone.dto.LayoutZoneDtos.StructureConstraintUpdateRequest;
import com.hwalro.simulation.zone.dto.LayoutZoneDtos.ZoneCreateRequest;
import com.hwalro.simulation.zone.mapper.LayoutZoneMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LayoutZoneServiceTest {
    private static final Long LAYOUT_ID = 802L;
    private static final Long VERSION_ID = 803L;

    @Mock
    private LayoutZoneMapper layoutZoneMapper;

    @Mock
    private DrawingMapper drawingMapper;

    private LayoutZoneService service;

    @BeforeEach
    void setUp() {
        Layout layout = new Layout();
        layout.setId(LAYOUT_ID);
        layout.setFloorPlanId(801L);
        layout.setCurrentVersionId(VERSION_ID);
        FloorPlan floorPlan = new FloorPlan();
        floorPlan.setId(801L);
        floorPlan.setWidth(BigDecimal.valueOf(100));
        floorPlan.setHeight(BigDecimal.valueOf(100));

        when(drawingMapper.findLayoutById(LAYOUT_ID)).thenReturn(layout);
        when(drawingMapper.findFloorPlanById(801L)).thenReturn(floorPlan);
        when(drawingMapper.findLayoutExitIdsByVersionId(VERSION_ID)).thenReturn(List.of(910L, 911L));
        when(drawingMapper.findFabricIdsByVersionId(VERSION_ID)).thenReturn(List.of(20L, 21L));
        when(layoutZoneMapper.findZonesByVersionId(VERSION_ID)).thenReturn(List.of());
        when(layoutZoneMapper.findZoneStructuresByVersionId(VERSION_ID)).thenReturn(List.of());

        service = new LayoutZoneService(layoutZoneMapper, drawingMapper);
    }

    private ZoneCreateRequest zone(
            String name, BigDecimal x, BigDecimal y, BigDecimal w, BigDecimal h, Long defaultExit, Long altExit) {
        return new ZoneCreateRequest(name, "WORK", x, y, w, h, null, defaultExit, altExit, null);
    }

    @Test
    void rejectsBlankAndOverlongZoneNames() {
        ZoneCreateRequest blank = zone("   ", ten(), ten(), ten(), ten(), null, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, blank))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이름");

        ZoneCreateRequest tooLong = zone("가".repeat(201), ten(), ten(), ten(), ten(), null, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, tooLong))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("깁니다");
    }

    @Test
    void rejectsDuplicateZoneNameInTheSameVersion() {
        LayoutZone existing = new LayoutZone();
        existing.setId(900L);
        existing.setName("작업 구역");
        when(layoutZoneMapper.findZonesByVersionId(VERSION_ID)).thenReturn(List.of(existing));

        ZoneCreateRequest request = zone("작업 구역", ten(), ten(), ten(), ten(), null, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 있는");
    }

    @Test
    void rejectsRectangleOutsideTheFloorPlan() {
        ZoneCreateRequest outside = zone("작업 구역", BigDecimal.valueOf(95), ten(), ten(), ten(), null, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, outside))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("벗어");

        ZoneCreateRequest zeroWidth = zone("작업 구역", ten(), ten(), BigDecimal.ZERO, ten(), null, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, zeroWidth))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("0보다");
    }

    @Test
    void rejectsIdenticalDefaultAndAlternateExits() {
        ZoneCreateRequest request = zone("작업 구역", ten(), ten(), ten(), ten(), 910L, 910L);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("서로 달라야");
    }

    @Test
    void rejectsExitFromAnotherLayoutVersion() {
        ZoneCreateRequest request = zone("작업 구역", ten(), ten(), ten(), ten(), 999L, null);
        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("없는 비상구");
    }

    @Test
    void rejectsStructureAlreadyOwnedByAnotherZone() {
        when(layoutZoneMapper.findZoneStructuresByVersionId(VERSION_ID))
                .thenReturn(List.of(new LayoutZoneStructure(VERSION_ID, 900L, 20L)));
        ZoneCreateRequest request =
                new ZoneCreateRequest("작업 구역", "WORK", ten(), ten(), ten(), ten(), null, null, null, List.of(20L));

        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 다른 구역");
    }

    @Test
    void rejectsStructureFromAnotherLayoutVersion() {
        ZoneCreateRequest request =
                new ZoneCreateRequest("작업 구역", "WORK", ten(), ten(), ten(), ten(), null, null, null, List.of(999L));

        assertThatThrownBy(() -> service.createZone(LAYOUT_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("없는 구조물");
    }

    @Test
    void immovableStructureStoresNoMovementDistance() {
        Fabric fabric = new Fabric();
        fabric.setId(20L);
        fabric.setLayoutVersionId(VERSION_ID);
        when(drawingMapper.findFabricsByVersionId(VERSION_ID)).thenReturn(List.of(fabric));
        when(drawingMapper.updateFabricConstraints(any())).thenReturn(1);

        service.updateStructureConstraints(
                LAYOUT_ID, 20L, new StructureConstraintUpdateRequest(false, BigDecimal.valueOf(5), false, null, null));

        ArgumentCaptor<Fabric> saved = ArgumentCaptor.forClass(Fabric.class);
        verify(drawingMapper).updateFabricConstraints(saved.capture());
        assertThat(saved.getValue().getMovable()).isFalse();
        assertThat(saved.getValue().getMaxMovementDistance()).isNull();
    }

    @Test
    void rejectsNonPositiveMovementDistance() {
        Fabric fabric = new Fabric();
        fabric.setId(20L);
        fabric.setLayoutVersionId(VERSION_ID);
        when(drawingMapper.findFabricsByVersionId(VERSION_ID)).thenReturn(List.of(fabric));
        StructureConstraintUpdateRequest request =
                new StructureConstraintUpdateRequest(true, BigDecimal.ZERO, false, null, null);

        assertThatThrownBy(() -> service.updateStructureConstraints(LAYOUT_ID, 20L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("0보다");
        verify(drawingMapper, never()).updateFabricConstraints(any());
    }

    private static BigDecimal ten() {
        return BigDecimal.TEN;
    }
}
