package com.hwalro.simulation.drawing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.DefaultDrawingData;
import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.domain.LayoutVersion;
import com.hwalro.simulation.drawing.domain.Wall;
import com.hwalro.simulation.drawing.dto.DrawingUpdateRequest;
import com.hwalro.simulation.drawing.dto.FabricDto;
import com.hwalro.simulation.drawing.dto.PillarDto;
import com.hwalro.simulation.drawing.dto.WallDto;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.zone.mapper.LayoutZoneMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
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
class DrawingServiceDisplayOrderTest {
    private static final Long LAYOUT_ID = 802L;
    private static final Long VERSION_ID = 803L;
    private static final JwtUser OWNER = new JwtUser(7L, Set.of("OPERATOR"));

    @Mock
    private DrawingMapper drawingMapper;

    @Mock
    private DefaultDrawingData defaultDrawingData;

    @Mock
    private LayoutGeometryValidator geometryValidator;

    @Mock
    private LayoutMetadataCopier layoutMetadataCopier;

    @Mock
    private LayoutZoneMapper layoutZoneMapper;

    @BeforeEach
    void setUp() {
        Layout layout = new Layout();
        layout.setId(LAYOUT_ID);
        layout.setFloorPlanId(801L);
        layout.setCurrentVersionId(VERSION_ID);
        layout.setCreatedBy(OWNER.userId());
        layout.setTitle("도면");

        FloorPlan floorPlan = new FloorPlan();
        floorPlan.setId(801L);
        floorPlan.setWidth(BigDecimal.valueOf(100));
        floorPlan.setHeight(BigDecimal.valueOf(100));

        LayoutVersion version = new LayoutVersion();
        version.setId(VERSION_ID);
        version.setLayoutId(LAYOUT_ID);
        version.setStatus("초안");
        version.setOptimisticLock(3);

        when(drawingMapper.findLayoutById(LAYOUT_ID)).thenReturn(layout);
        when(drawingMapper.findFloorPlanById(801L)).thenReturn(floorPlan);
        when(drawingMapper.findLayoutVersionById(VERSION_ID)).thenReturn(version);
        when(drawingMapper.updateLayout(any())).thenReturn(1);
        when(drawingMapper.updateLayoutVersionLock(anyLong(), anyInt(), anyInt()))
                .thenReturn(1);
        when(drawingMapper.findWallIdsByVersionId(VERSION_ID)).thenReturn(List.of());
        when(drawingMapper.findPillarIdsByVersionId(VERSION_ID)).thenReturn(List.of());
        when(drawingMapper.findFabricIdsByVersionId(VERSION_ID)).thenReturn(List.of());
        when(drawingMapper.findLayoutExitIdsByVersionId(VERSION_ID)).thenReturn(List.of());
        when(drawingMapper.findWallsByVersionId(anyLong())).thenReturn(List.of());
        when(drawingMapper.findPillarsByVersionId(anyLong())).thenReturn(List.of());
        when(drawingMapper.findFabricsByVersionId(anyLong())).thenReturn(List.of());
        when(drawingMapper.findOutsideWallsByVersionId(anyLong())).thenReturn(List.of());
        when(drawingMapper.findLayoutTextsByVersionId(anyLong())).thenReturn(List.of());
        when(drawingMapper.findLayoutExitsByVersionId(anyLong())).thenReturn(List.of());
    }

    @Test
    void requestArrayIndexesAreStoredAsDisplayOrder() {
        service()
                .update(
                        LAYOUT_ID,
                        new DrawingUpdateRequest(
                                "도면",
                                null,
                                List.of(wallDto(null), wallDto(null), wallDto(null)),
                                List.of(),
                                List.of(pillarDto(null), pillarDto(null)),
                                List.of(fabricDto(null), fabricDto(null), fabricDto(null)),
                                List.of(),
                                List.of(),
                                3),
                        OWNER);

        ArgumentCaptor<Wall> walls = ArgumentCaptor.forClass(Wall.class);
        verify(drawingMapper, org.mockito.Mockito.times(3)).insertWall(walls.capture());
        assertThat(walls.getAllValues()).extracting(Wall::getDisplayOrder).containsExactly(0, 1, 2);

        ArgumentCaptor<Fabric> fabrics = ArgumentCaptor.forClass(Fabric.class);
        verify(drawingMapper, org.mockito.Mockito.times(3)).insertFabric(fabrics.capture());
        assertThat(fabrics.getAllValues()).extracting(Fabric::getDisplayOrder).containsExactly(0, 1, 2);

        org.mockito.ArgumentCaptor<com.hwalro.simulation.drawing.domain.Pillar> pillars =
                org.mockito.ArgumentCaptor.forClass(com.hwalro.simulation.drawing.domain.Pillar.class);
        verify(drawingMapper, org.mockito.Mockito.times(2)).insertPillar(pillars.capture());
        assertThat(pillars.getAllValues())
                .extracting(com.hwalro.simulation.drawing.domain.Pillar::getDisplayOrder)
                .containsExactly(0, 1);
    }

    @Test
    void explicitDisplayOrderIsStoredAcrossKinds() {
        service()
                .update(
                        LAYOUT_ID,
                        new DrawingUpdateRequest(
                                "도면",
                                null,
                                List.of(wallDto(null, 2), wallDto(null, 0)),
                                List.of(),
                                List.of(pillarDto(null, 3)),
                                List.of(fabricDto(null, 1)),
                                List.of(),
                                List.of(),
                                3),
                        OWNER);

        ArgumentCaptor<Wall> walls = ArgumentCaptor.forClass(Wall.class);
        verify(drawingMapper, org.mockito.Mockito.times(2)).insertWall(walls.capture());
        assertThat(walls.getAllValues()).extracting(Wall::getDisplayOrder).containsExactly(2, 0);

        ArgumentCaptor<Fabric> fabrics = ArgumentCaptor.forClass(Fabric.class);
        verify(drawingMapper).insertFabric(fabrics.capture());
        assertThat(fabrics.getValue().getDisplayOrder()).isEqualTo(1);

        org.mockito.ArgumentCaptor<com.hwalro.simulation.drawing.domain.Pillar> pillars =
                org.mockito.ArgumentCaptor.forClass(com.hwalro.simulation.drawing.domain.Pillar.class);
        verify(drawingMapper).insertPillar(pillars.capture());
        assertThat(pillars.getValue().getDisplayOrder()).isEqualTo(3);
    }

    private DrawingService service() {
        return new DrawingService(
                drawingMapper, defaultDrawingData, geometryValidator, layoutMetadataCopier, layoutZoneMapper);
    }

    private static WallDto wallDto(Long id) {
        return wallDto(id, null);
    }

    private static WallDto wallDto(Long id, Integer displayOrder) {
        return new WallDto(id, "", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ONE, displayOrder);
    }

    private static PillarDto pillarDto(Long id) {
        return pillarDto(id, null);
    }

    private static PillarDto pillarDto(Long id, Integer displayOrder) {
        return new PillarDto(
                id,
                "",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                displayOrder);
    }

    private static FabricDto fabricDto(Long id) {
        return fabricDto(id, null);
    }

    private static FabricDto fabricDto(Long id, Integer displayOrder) {
        return new FabricDto(
                id,
                "",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                displayOrder);
    }
}
