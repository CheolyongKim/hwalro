# Graph Report - hwalro-140  (2026-08-24)

## Corpus Check
- 463 files · ~201,361 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4528 nodes · 13576 edges · 166 communities (135 shown, 31 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 1467 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157

## God Nodes (most connected - your core abstractions)
1. `JwtUser` - 136 edges
2. `GridRouter` - 99 edges
3. `DrawingMapper` - 73 edges
4. `SimulationMapper` - 70 edges
5. `LayoutSearchCandidateEntity` - 67 edges
6. `SimulationExecutionServiceTest` - 67 edges
7. `SimulationService` - 66 edges
8. `Simulation` - 65 edges
9. `PointDto` - 64 edges
10. `DrawingService` - 61 edges

## Surprising Connections (you probably didn't know these)
- `_find_exit_path_targets()` --uses--> `SearchConstraints`  [INFERRED]
  apps/simulation-service/engine/layout_search.py → apps/simulation-service/engine/constraints.py
- `_find_qualifying_targets()` --uses--> `SearchConstraints`  [INFERRED]
  apps/simulation-service/engine/layout_search.py → apps/simulation-service/engine/constraints.py
- `_find_rebalance_targets()` --uses--> `SearchConstraints`  [INFERRED]
  apps/simulation-service/engine/layout_search.py → apps/simulation-service/engine/constraints.py
- `_generate_from_findings()` --uses--> `SearchConstraints`  [INFERRED]
  apps/simulation-service/engine/layout_search.py → apps/simulation-service/engine/constraints.py
- `_generate_from_parents()` --uses--> `SearchConstraints`  [INFERRED]
  apps/simulation-service/engine/layout_search.py → apps/simulation-service/engine/constraints.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **** — apps/simulation-service/engine/PERFORMANCE.md::runner, apps/simulation-service/engine/PERFORMANCE.md::jupedsim_wheel, apps/simulation-service/engine/README.md::output_contract [INFERRED]
- **** — apps/simulation-service/src/main/java/com/hwalro/simulation/search/AGENTS.md::candidate_generation, apps/simulation-service/src/main/java/com/hwalro/simulation/search/AGENTS.md::verify_optional, apps/simulation-service/src/main/java/com/hwalro/simulation/search/AGENTS.md::trial_validation, apps/simulation-service/src/main/java/com/hwalro/simulation/search/AGENTS.md::adoption_draft [INFERRED]

## Communities (166 total, 31 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (90): Badge(), BadgeProps, BadgeTone, toneClasses, Button(), ButtonProps, ButtonSize, ButtonVariant (+82 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (88): CreateDrawingPage(), useRecordLastActivity(), SegmentResponse, simulationResultProvider, SimulationResultSummaryResponse, EvacuationProgressChart(), PlaybackControls(), Props (+80 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (69): apiClient, listeners, setSessionExpiredHandler(), tokenStore, App(), iconPaths, NavigationChild, NavigationItem (+61 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (58): buttonClassName(), ChangeSet, CompareView, HoldToCompare(), oppositeCompareView(), Props, DrawingElements(), DrawingElementsProps (+50 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (24): BottleneckFindingExtractor, Rectangle, Accumulator, CellKey, CongestionFindingExtractor, GridInfo, DiagnosisAssembler, EvacuationTailFindingExtractor (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (3): LayoutSearchEntity, SearchBudget, SearchBudgetTest

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (4): LayoutSearchCandidateEntity, CandidateAdoptionServiceTest, Fabric, org.mockito.junit.jupiter.MockitoSettings

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (45): getDrawingErrorMessage(), homeApi, ActiveReviewCard(), ActiveReviewCardProps, formatDateTime(), PriorityRiskPanel(), PriorityRiskPanelProps, SEVERITY_CONFIG (+37 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (40): containing_component(), parse_hazards(), Return the physical component containing a routing component., _add_agent_with_spacing(), AgentRouteUnreachableRunnerError, _agents(), _apply_recovery_mutation(), _apply_reroute_mutation() (+32 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (16): RectangleGeometry, BottleneckDetector, Cell, CellBounds, CoreComponent, DetectionState, EventAccumulator, DetectedBottleneck (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (60): InlineTextInput(), InlineTextInputProps, BackgroundLayer, ExitView, FabricView, GridLayerProps, GridLine, imageCache (+52 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (55): applyBackgroundDragStart(), applyBackgroundInsert(), applyBackgroundOpacity(), applyBackgroundRemove(), applyBackgroundResize(), applyBackgroundResizeStart(), applyDragUpdate(), applyLineReshapeUpdate() (+47 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (4): EngineResult, EngineRun, Simulation, SimulationExecutionServiceTest

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (42): CompletionToast(), CompletionToastProps, CompletionToastViewport(), ProtectedRoute(), AiReportDraftCreateRequest, reportApi, ReportListParams, AiReportCompletionNotifier() (+34 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (58): apply_constraints(), _apply_rotations(), _apply_structure_count(), _assemble_boundary(), build(), cell_ids(), cells(), constraint_combos() (+50 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (51): ExitViewProps, FabricViewProps, PillarViewProps, TextViewProps, WallViewProps, LayoutCanvasProps, BackgroundSection(), ExitFieldsProps (+43 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (16): _fabric_geometry(), _key_to_int(), parse_constraints(), Any, User-supplied constraints for layout search candidates. Constraint model (all…, True when the fabric rectangle touches any wall segment within tolerance., SearchConstraints, touches_wall() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (39): lawApi, riskApi, AttachedLawChipList(), buildArticleLabel(), LawDetailChips(), formatDate(), LawArticlePickerModal(), Props (+31 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (49): GridLayer, closestPointOnSegment(), distanceToSegment(), ZoneDragSession, AgentDeletionConfirmDialog(), AgentDeletionConfirmDialogProps, AgentDeletionSuccessToast(), AgentDeletionSuccessToastProps (+41 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (46): CandidateRationale, CandidateStatus, ChangeOp, emptyConstraints(), FabricTransform, LayoutSearch, layoutSearchApi, MetricDelta (+38 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (45): _assemble_boundary(), _assert_same_output(), _base_payload(), _benchmark_scenario(), BenchmarkError, _build_scenarios(), _comparable_files(), _correctness_scenario() (+37 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (7): Exit, GridRouter, One global reverse-Dijkstra field; each planned route is immutable., GridRoutingTest, PlanCostTest, RecoverySeedCacheTest, Polygon

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (50): agents(), base_input(), bottleneck_finding(), multi_finding_input(), ops_key(), Tests for the diagnostic-beam layout search., An empty target list used to cost the finding every candidate it could produce.…, The production contract: EXIT_IMBALANCE never carries a region. Requiring one… (+42 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (16): _activate_due_agents(), _active_agents_and_positions(), _advance_context(), _detect_exit_crossings(), _initialize_targets(), _rollback_invalid_moves(), SimulationContext, _snapshot() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (28): Override, JwtAuthInterceptor, RequireRole, HealthController, DrawingListResponse, ImprovementProposalController, SimulationDrawingContextController, SimulationReportContextController (+20 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (16): ForbiddenException, SimulationDrawingContextRequest, SimulationDrawingContextResponse, SimulationReportContextRequest, Metric, SimulationReportContextResponse, SimulationResultNotFoundException, BottleneckRow (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (47): _assess(), _assess_moves(), _changed_bounds(), _clearance_gain(), _decimal(), drawing_walls(), _exit_centers(), _exit_opening_variants() (+39 more)

### Community 27 - "Community 27"
Cohesion: 0.08
Nodes (3): SimulationMetric, SimulationResult, SimulationMetric

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (5): Layout, LayoutVersion, DrawingNotFoundException, ExitDto, org.springframework.transaction.annotation.Transactional

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (18): ChangeOp, FabricTransform, ChangeSet, ChangeSetApplier, Fabric, FabricTransform, Pillar, Wall (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (36): inverse_proxy_model(), metadata_of(), parametrize, Tests for the surrogate runtime: bundle validation, modes and guarded scoring., A real LightGBM model whose score decreases as `proxy_score` grows. Only the…, rewrite_metadata(), stub_runtime(), test_active_degrades_to_shadow_for_an_unpromoted_bundle() (+28 more)

### Community 31 - "Community 31"
Cohesion: 0.21
Nodes (6): DensityThreshold, BottleneckDetectorTest, Frame, HeatmapChunk, SimulationExecutionConfigTest, org.junit.jupiter.api.Test

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (3): SimulationNotFoundException, SimulationMapper, SimulationService

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (41): add(), axisEnterT(), circleSegmentAngles(), clampLineDraft(), clampMoveDelta(), clampRectDraft(), clampRotate(), cornerArcDelta() (+33 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (7): _build_recovery_summary(), mid_route_recovery_scan(), recovery_scan(), Agent, Exit, MidRouteRecoveryScanTest, RecoveryScanTest

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (9): JwtUser, DrawingController, SimulationController, SimulationExecutionResponse, SimulationOverviewPageResponse, SimulationOverviewResponse, io.swagger.v3.oas.annotations.Operation, io.swagger.v3.oas.annotations.responses.ApiResponses (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (19): Bottleneck, SimulationReportVisualContextResponse, Bottleneck, Bounds, Drawing, HazardZone, LayoutText, Point (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (8): Metric, MetricDelta, CandidateSelector, MetricDelta, Judgement, RankableCandidate, Metric, TrialBudgetCalculator

### Community 38 - "Community 38"
Cohesion: 0.05
Nodes (39): AABB 조기 종료 검사, Agent handle 수명 규칙, benchmark.py 성능 측정, 전체 Agent 일괄 처리, 출력 동등성 정확성 검증, GridRouter 경로 계산기, jupedsim-hwalro 커스텀 wheel, 단건 Agent 조회 제곱 병목 (+31 more)

### Community 39 - "Community 39"
Cohesion: 0.07
Nodes (25): CandidateStatus, EVALUATED, FAILED, GENERATED, NOT_IMPROVED, QUEUED, REJECTED_CONSTRAINT, RUNNING (+17 more)

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (8): SimulationFailureDetailResponse, SimulationSetupResponse, EngineRunException, HeatmapChunk, ProcessOutputCapture, SimulationEngineRunner, TimelineChunk, SimulationEngineUnavailableException

### Community 41 - "Community 41"
Cohesion: 0.10
Nodes (30): CanvasWorkspace(), CanvasWorkspaceBackButton(), CanvasWorkspaceBackButtonProps, CanvasWorkspaceHeader(), CanvasWorkspaceHeaderProps, CanvasWorkspacePanel(), CanvasWorkspacePanelProps, CanvasWorkspacePanelRestore (+22 more)

### Community 42 - "Community 42"
Cohesion: 0.09
Nodes (3): SimulationConflictException, SimulationExecutionService, com.fasterxml.jackson.databind.JsonNode

### Community 43 - "Community 43"
Cohesion: 0.10
Nodes (12): DefaultDrawing, DefaultDrawingData, DefaultExit, DefaultFabric, DefaultLayoutText, DefaultOutsideWall, DefaultPillar, DefaultWall (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (8): Edge, ValidationProblem, LayoutGeometryValidator, Point, PointIndex, Segment, TaggedSegment, Walk

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (9): FabricChange, FabricState, ProposalCandidate, Direction, FabricCandidateGenerator, ProposalBeamSearch, FabricCandidateGeneratorTest, NearbyClearanceEvaluatorTest (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.10
Nodes (14): ProposalEvaluation, BottleneckFabricSelector, ImprovementProposalGenerationService, BottleneckGeometry, ImprovementSourceLoader, Point, NearbyClearanceEvaluator, ProposalEvaluationService (+6 more)

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (13): ExitBalanceFindingExtractor, LayoutSearchMapper, CandidateTrialService, LayoutSearchOrchestrator, LayoutSearchRecoveryService, LayoutSearchSourceLoader, EngineCapacity, AgentPositions (+5 more)

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (5): PlacementAdjustmentDraftRequest, HazardZone, OutsideWall, Simulation, SimulationServiceTest

### Community 50 - "Community 50"
Cohesion: 0.13
Nodes (24): _build_geometry(), _exit_points(), _id_key(), _line_points(), _outside_polygon(), parse_exit_segments(), parse_exits(), _point() (+16 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (30): PanSession, CanvasListeners, useCanvasListeners(), UseCanvasListenersOptions, ZoomControl(), Camera, DrawingDocument, Vec2 (+22 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (5): ImprovementSourceMapper, ImprovementSourceLoaderTest, Fabric, Pillar, StoredBottleneck

### Community 53 - "Community 53"
Cohesion: 0.13
Nodes (13): DrawingResponse, DrawingUpdateRequest, DrawingVersionSummary, ExitDto, FabricDto, LayoutTextDto, OutsideWallDto, PillarDto (+5 more)

### Community 54 - "Community 54"
Cohesion: 0.08
Nodes (4): DrawingSummary, SimulationCountByLayout, DrawingMapper, DrawingListResponse

### Community 55 - "Community 55"
Cohesion: 0.10
Nodes (23): Bundle, BundleError, create(), load_bundle(), normalize_mode(), Any, Path, RuntimeError (+15 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (11): ComparableSimulation, ComparableSimulationPageResponse, ComparableRow, HazardZoneRow, SegmentRow, SimulationResultDetailMapper, SummaryRow, Drawing (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.15
Nodes (6): PointDto, Cell, EdgeKey, Escape, PointKey, SimulationGeometry

### Community 60 - "Community 60"
Cohesion: 0.09
Nodes (9): Wall, DrawingInput, ExitInput, RectangleInput, SearchSource, SegmentInput, TextInput, HazardZoneDto (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (9): ApiExceptionHandler, InvalidTokenException, DrawingDeletionNotAllowedException, org.springframework.dao.DataIntegrityViolationException, org.springframework.http.converter.HttpMessageNotReadableException, org.springframework.web.bind.annotation.ExceptionHandler, org.springframework.web.bind.annotation.ResponseStatus, org.springframework.web.bind.annotation.RestControllerAdvice (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.14
Nodes (26): DrawingLayoutVersionStatus, DrawingSession, fetchDrawing(), fetchDrawingVersions(), restoreDrawingVersion(), saveDrawing(), toSession(), statusBadge() (+18 more)

### Community 63 - "Community 63"
Cohesion: 0.10
Nodes (27): _bounds(), build_record(), _center(), extract_features(), feature_snapshot(), _float(), _ops(), Any (+19 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (5): Fabric, Fabric, OutsideWall, SimulationGeometryRelaxationScaleTest, org.junit.jupiter.api.Timeout

### Community 65 - "Community 65"
Cohesion: 0.08
Nodes (3): OutsideWall, OutsideWall, OutsideWall

### Community 66 - "Community 66"
Cohesion: 0.17
Nodes (6): CorridorClearance, Point, CorridorClearanceEvaluator, Direction, Point, CorridorClearanceEvaluatorTest

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (17): CandidateDto, ChangeOpDto, ChangeSetDto, DiagnosisDto, EvidenceDto, FabricTransformDto, FindingDto, LayoutSearchDtos (+9 more)

### Community 69 - "Community 69"
Cohesion: 0.23
Nodes (5): Fabric, OutsideWall, Pillar, Wall, SimulationGeometryRelaxationTest

### Community 70 - "Community 70"
Cohesion: 0.23
Nodes (4): BottleneckArea, HeatmapChunk, ImprovementSource, RotatedRectangle

### Community 71 - "Community 71"
Cohesion: 0.17
Nodes (10): AgentRouteUnreachableError, Raised only when an otherwise valid agent cannot connect to the route grid., HeatmapWriter, main(), _sample_initial_response_times(), AgentRouteErrorContractTest, HeatmapWriterTest, InitialResponseTimeTest (+2 more)

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (22): install_stub_booster(), ops_keys(), parametrize, Surrogate mode behaviour of the layout search: OFF, SHADOW, ACTIVE and fallback., Replace the loaded model with one that misbehaves, keeping bundle validation…, single_fabric_input(), test_a_broken_bundle_falls_the_whole_round_back_to_the_proxy(), test_a_non_finite_prediction_falls_the_whole_round_back_to_the_proxy() (+14 more)

### Community 73 - "Community 73"
Cohesion: 0.14
Nodes (4): Geometry, Interval, Point, GeometryTest

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (8): SimulationSchemaIntegrationTest, java.sql.Connection, java.sql.Statement, org.apache.ibatis.session.SqlSessionFactory, org.junit.jupiter.api.AfterEach, org.junit.jupiter.api.BeforeAll, org.testcontainers.containers.MySQLContainer, org.testcontainers.junit.jupiter.Testcontainers

### Community 75 - "Community 75"
Cohesion: 0.13
Nodes (12): DetectedBottleneck, DraftCreateRequest, ExitEventResponse, SimulationDtos, SimulationMetricResponse, SimulationResultResponse, SimulationRoutingValidationResponse, TimelineAgentResponse (+4 more)

### Community 76 - "Community 76"
Cohesion: 0.17
Nodes (5): FabricTransform, LayoutSearchRunner, SearchInput, SearchLogRelay, SearchRunException

### Community 77 - "Community 77"
Cohesion: 0.15
Nodes (10): Override, NoOpTransactionManager, Override, NoOpTransactionManager, Override, NoOpTransactionManager, org.junit.jupiter.api.BeforeEach, org.springframework.transaction.PlatformTransactionManager (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+15 more)

### Community 79 - "Community 79"
Cohesion: 0.16
Nodes (5): _point_array(), Point, Where an agent joins the grid, and what the rest of its route costs., What a route costs and where it leaves, without walking the path. A layout…, ndarray

### Community 81 - "Community 81"
Cohesion: 0.09
Nodes (23): dependencies, axios, d3-shape, konva, lucide-react, pixi.js, qrcode, react (+15 more)

### Community 82 - "Community 82"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, happy-dom, prettier, @types/d3-shape, @types/qrcode, @types/react, @types/react-dom (+15 more)

### Community 83 - "Community 83"
Cohesion: 0.14
Nodes (13): edge_cost(), edge_costs(), Hazard, hazard_multiplier(), hazard_multipliers(), Return the maximum radial multiplier at *point*., `hazard_multiplier` over whole coordinate arrays, term for term., `edge_cost` over whole coordinate arrays, term for term. The Simpson terms keep… (+5 more)

### Community 85 - "Community 85"
Cohesion: 0.24
Nodes (5): Fabric, OutsideWall, Pillar, Wall, SimulationGeometryTest

### Community 86 - "Community 86"
Cohesion: 0.16
Nodes (22): _actionable_findings(), _agent_centroid(), _baseline(), _exit_demand(), ExitDemand, _find_exit_opening_targets(), _find_exit_path_targets(), _find_qualifying_targets() (+14 more)

### Community 87 - "Community 87"
Cohesion: 0.19
Nodes (11): build_routing_geometry(), build_walkable_geometry(), Build the outside polygon minus thin walls and rectangular obstacles., Build center-point routing space with clearance for an agent disk., Keep the one connected area containing every agent and selected exit., Keep the one connected area containing every agent center., Group indexed agents by the one routing component containing each center., select_accessible_component() (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.10
Nodes (3): LayoutText, LayoutText, DrawingSnapshot

### Community 90 - "Community 90"
Cohesion: 0.20
Nodes (13): RegulationArticle, RegulationDetail, RegulationSummary, SearchResponse, ArticleList(), formatDate(), Props, RegulationDetailPanel() (+5 more)

### Community 91 - "Community 91"
Cohesion: 0.16
Nodes (9): JwtProperties, JwtTokenProvider, RegulationServiceProperties, SimulationServiceApplication, io.jsonwebtoken.Claims, javax.crypto.SecretKey, org.springframework.boot.autoconfigure.SpringBootApplication, org.springframework.boot.context.properties.ConfigurationProperties (+1 more)

### Community 93 - "Community 93"
Cohesion: 0.19
Nodes (6): ImprovementProposalExecutionResponse, ImprovementProposalExecutionResult, ImprovementProposalResponse, ImprovementProposalQueryService, org.junit.jupiter.api.extension.ExtendWith, org.mockito.junit.jupiter.MockitoExtension

### Community 94 - "Community 94"
Cohesion: 0.18
Nodes (5): ImprovementProposalMapper, ImprovementProposalExecutionReservationService, SimulationResultGenerationClient, SimulationStartResult, ImprovementProposalExecutionReservationServiceTest

### Community 95 - "Community 95"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, composite, isolatedModules, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 96 - "Community 96"
Cohesion: 0.12
Nodes (14): _clamp01(), _exit_capacity_term(), _imbalance(), _mean(), _percentile(), _proxy_score(), Rejection reasons: bounded examples, unbounded counts., Max demand-per-exit-width ratio. Higher = more congested exits. (+6 more)

### Community 97 - "Community 97"
Cohesion: 0.20
Nodes (8): ChangeData, ChangeHighlight, ChangeOperation, ChangeSummary, ImprovementProposalService, RectangleData, RiskInterpretation, VerificationGuide

### Community 98 - "Community 98"
Cohesion: 0.23
Nodes (10): OpenApiConfig, ThreadPoolTaskExecutor, LayoutSearchConfig, ThreadPoolTaskExecutor, SimulationExecutionConfig, io.swagger.v3.oas.models.OpenAPI, OpenAPI, org.springframework.context.annotation.Bean (+2 more)

### Community 99 - "Community 99"
Cohesion: 0.24
Nodes (7): Grid, HeatmapData, HeatmapFrame, HeatmapOverlapEvaluator, Point, Threshold, HeatmapOverlapEvaluatorTest

### Community 100 - "Community 100"
Cohesion: 0.19
Nodes (4): AgentHandle, FailingState, Wraps an AgentRouteState and raises on the chosen setter occurrence., setter

### Community 101 - "Community 101"
Cohesion: 0.24
Nodes (3): ImprovementProposalExecutionRequest, ImprovementProposalExecutionService, ImprovementProposalControllerTest

### Community 102 - "Community 102"
Cohesion: 0.12
Nodes (3): HazardZone, HazardZone, HazardZone

### Community 103 - "Community 103"
Cohesion: 0.23
Nodes (14): ForbiddenZone, SearchConstraints, ConstraintEditorProps, ConstraintEditorTool, ConstraintInspector(), fabricBadges(), fabricCorners(), formatZone() (+6 more)

### Community 104 - "Community 104"
Cohesion: 0.22
Nodes (6): AgentRouteState, _passed_waypoint(), _waypoint_reached(), _within_waypoint(), TerminationDetailTest, WaypointProgressTest

### Community 105 - "Community 105"
Cohesion: 0.32
Nodes (3): Point, ProposalConstraintValidator, ProposalConstraintValidatorTest

### Community 108 - "Community 108"
Cohesion: 0.31
Nodes (4): BottleneckAnalysisMapper, DensityThresholdRow, DensityThresholdProvider, DensityThresholdProviderTest

### Community 109 - "Community 109"
Cohesion: 0.26
Nodes (10): DrawingText, fallbackName(), generateRiskZoneName(), nearestText(), normalizeText(), relativeStoreDirection(), RiskZoneNameDrawing, storeDistanceLimit() (+2 more)

### Community 110 - "Community 110"
Cohesion: 0.35
Nodes (5): _coords_only(), _Generation, Deterministic raw candidate generation. Knows nothing about ranking., The baseline router, but only for the layout it was actually built on. Deriving…, _raw_fabric_id()

### Community 112 - "Community 112"
Cohesion: 0.20
Nodes (3): FakeJps, FakeSimulation, SfmParameterForwardingTest

### Community 116 - "Community 116"
Cohesion: 0.27
Nodes (9): drawHighlight(), fillRotatedRect(), MinimapDrawing, MinimapHighlight, MinimapPoint, MinimapSegment, Props, SimulationMinimap() (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.33
Nodes (9): _fabric_ids(), _histogram(), main(), Any, Offline probe for the layout search candidate pool. Runs no JuPedSim trial.…, True when the move leaves every routing statistic untouched. A candidate the…, _routing_inert(), _run() (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.25
Nodes (9): 후보 채택 DRAFT 생성, 배치 변경 후보 생성, EVALUATED 실측 개선 후보, 배치 개선안 탐색 지침, proxy_score 내부 랭킹, QUEUED 미검증 후보, 재시작 후보 복구 재시도, layout_search_trials 저장 (+1 more)

### Community 119 - "Community 119"
Cohesion: 0.22
Nodes (9): scripts, build, clean, dev, format, format:check, lint, preview (+1 more)

### Community 121 - "Community 121"
Cohesion: 0.31
Nodes (9): assert_java_contract(), bottom_edge_drawing(), bottom_edge_finding(), Eight fabrics hugging the bottom wall: every downward move leaves the room., Mirror of `LayoutSearchRunner.validate`, which fails the whole search. Java re-…, test_generated_results_satisfy_the_java_result_contract(), test_rejected_examples_carry_attempted_move_coordinates(), test_rejection_examples_are_capped_but_counts_are_complete() (+1 more)

### Community 122 - "Community 122"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, clean, dev, format, lint

### Community 124 - "Community 124"
Cohesion: 0.44
Nodes (3): CandidateAdoptionService, Fabric, FabricTransform

### Community 125 - "Community 125"
Cohesion: 0.46
Nodes (8): RegulationsPage(), handleResultScroll(), handleSubmit(), loadRegulations(), loadRelatedLaws(), selectDetail(), selectLaw(), selectLawById()

### Community 128 - "Community 128"
Cohesion: 0.29
Nodes (7): 연결 도면 삭제 제한, 도면 도메인 지침, OPERATOR 도면 소유권, layout_version_id 버전 분리, 도면 Mapper 지침, 버전 기준 도형 SQL, 목록 SQL 계약 유지

### Community 129 - "Community 129"
Cohesion: 0.38
Nodes (6): build_payload(), main(), Any, Deterministic builder for the synthetic stall-family fixture. Synthetic…, Return the deterministic synthetic stall-family input payload., _snap()

### Community 130 - "Community 130"
Cohesion: 0.38
Nodes (4): Override, WebConfig, org.springframework.web.servlet.config.annotation.InterceptorRegistry, org.springframework.web.servlet.config.annotation.WebMvcConfigurer

### Community 131 - "Community 131"
Cohesion: 0.43
Nodes (3): Override, SimulationTask, java.util.concurrent.FutureTask

### Community 133 - "Community 133"
Cohesion: 0.47
Nodes (3): RegulationUsageClient, RegulationUsageResponse, org.springframework.web.client.RestClient

### Community 134 - "Community 134"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (4): auth-service JWT 발급, userId/roles 클레임 계약, Simulation JWT 지침, simulation-service JWT 소비

### Community 137 - "Community 137"
Cohesion: 0.50
Nodes (4): 현재 버전 원자적 전환, 버전 충돌 예외 응답, 도면 서비스 지침, optimisticLock 비교 갱신

### Community 138 - "Community 138"
Cohesion: 0.50
Nodes (4): 개선안 도메인 지침, 시뮬레이션·개선안 계보, 공식 지표 대체 금지, 저장 개선안 비재생성

### Community 139 - "Community 139"
Cohesion: 0.50
Nodes (4): 기하 규칙 평가 영향, 좌표계·허용 오차 일관성, 경계·영 면적 테스트, 개선안 기하 연산 지침

### Community 140 - "Community 140"
Cohesion: 0.50
Nodes (4): 개선안 Mapper 지침, JSON·복합 FK 변경 확인, 동일 계보 조회 보장, 미저장 개선안만 삭제

### Community 141 - "Community 141"
Cohesion: 0.50
Nodes (4): 도면·시뮬레이션 계보 조인, Simulation Mapper 지침, 파라미터 바인딩 규칙, SQL·Mapper·schema 동시 확인

### Community 142 - "Community 142"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 143 - "Community 143"
Cohesion: 0.67
Nodes (3): 프론트엔드 HTML 진입점, 현대백화점그룹 파비콘, main.tsx 모듈 엔트리

### Community 144 - "Community 144"
Cohesion: 0.67
Nodes (3): 좌표·단위 일관성, 도면 도메인 모델 지침, DTO·영속 객체 책임 분리

### Community 145 - "Community 145"
Cohesion: 0.67
Nodes (3): 개선안 Controller 지침, 내부 평가 상세 비노출, 권한·소유권 검증

### Community 146 - "Community 146"
Cohesion: 0.67
Nodes (3): 개선안 서비스 지침, 원본 시뮬레이션 잠금, 생성·평가·저장 책임 분리

## Knowledge Gaps
- **338 isolated node(s):** `setup-macos.sh script`, `name`, `private`, `dev`, `build` (+333 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JwtUser` connect `Community 35` to `Community 5`, `Community 6`, `Community 12`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 32`, `Community 36`, `Community 39`, `Community 40`, `Community 42`, `Community 43`, `Community 47`, `Community 48`, `Community 53`, `Community 54`, `Community 56`, `Community 57`, `Community 67`, `Community 75`, `Community 77`, `Community 84`, `Community 91`, `Community 93`, `Community 101`, `Community 114`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `LayoutSearchProperties` connect `Community 89` to `Community 32`, `Community 98`, `Community 67`, `Community 5`, `Community 39`, `Community 47`, `Community 91`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `DrawingMapper` connect `Community 54` to `Community 4`, `Community 133`, `Community 6`, `Community 28`, `Community 29`, `Community 32`, `Community 36`, `Community 39`, `Community 43`, `Community 46`, `Community 47`, `Community 48`, `Community 52`, `Community 53`, `Community 56`, `Community 60`, `Community 65`, `Community 70`, `Community 77`, `Community 84`, `Community 88`, `Community 93`, `Community 108`, `Community 124`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `JwtUser` (e.g. with `.operatorCannotReadAnotherUsersResult()` and `.rejectsInvalidIdsBeforeQuerying()`) actually correct?**
  _`JwtUser` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `GridRouter` (e.g. with `_assess()` and `_Generation`) actually correct?**
  _`GridRouter` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `setup-macos.sh script`, `name`, `private` to the rest of the system?**
  _338 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03855232100708104 - nodes in this community are weakly interconnected._