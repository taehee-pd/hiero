# IconStudio IA Redesign — Feature Inventory & Information Architecture

> Figma, Glyphs 3, SF Symbols 등 전문 디자인 툴 레퍼런스 기반 IA 재설계 문서
> 현재 기능의 완전한 인벤토리 + 전문 툴 기준 재배치 제안

---

## 1. 현재 기능 인벤토리 (Complete Feature List)

### 1.1 Drawing & Path Tools
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Select Tool (V) | ToolPanel (좌측 독) | 레이어 선택 |
| Direct Select Tool (A) | ToolPanel | 앵커포인트/핸들 직접 편집 |
| Pen Tool (P) | ToolPanel | 베지어 패스 드로잉 |
| Shape Tool (U) | ToolPanel → 서브메뉴 | Rectangle, Ellipse, Polygon, Star, Line |
| Guide Tool (G) | ToolPanel (disabled) | 가이드 배치 |
| Polygon Sides 설정 | InspectorPanel > Shape Tool Settings | 셰이프 툴 활성 시 |
| Star Points 설정 | InspectorPanel > Shape Tool Settings | 셰이프 툴 활성 시 |
| Corner Radius | InspectorPanel > Vector Section | 포인트 선택 시 |

### 1.2 Selection & Transform
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Marquee Selection | Canvas overlay | 드래그 선택 |
| Multi-select | Canvas | Shift+Click |
| Point Selection | Canvas (Direct Select 모드) | 앵커포인트 개별 선택 |
| Move (X, Y) | InspectorPanel > Transform Section | 숫자 입력 |
| Rotate | InspectorPanel > Transform Section | 각도 입력 |
| Scale X/Y | InspectorPanel > Transform Section | 개별 축 스케일 |
| Point Position (X, Y) | InspectorPanel > Vector Section | 포인트 좌표 |
| Handle In/Out (X, Y) | InspectorPanel > Vector Section | 단일 포인트 선택 시 |

### 1.3 Point Editing
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Node Type: Corner | InspectorPanel > Vector Section | 4가지 타입 |
| Node Type: Smooth | InspectorPanel > Vector Section | |
| Node Type: Mirror Angle | InspectorPanel > Vector Section | |
| Node Type: Symmetric | InspectorPanel > Vector Section | |
| Point Align (6방향) | InspectorPanel > Vector Section | 3x3 그리드 |
| Point Distribute (H/V) | InspectorPanel > Vector Section | |
| Delete Points | Keyboard (Delete/Backspace) | |
| Split Segment | Context menu | |

### 1.4 Boolean Operations
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Unite | InspectorPanel > Boolean Section | 2개 이상 패스 선택 필요 |
| Subtract | InspectorPanel > Boolean Section | |
| Intersect | InspectorPanel > Boolean Section | |
| Exclude | InspectorPanel > Boolean Section | |

### 1.5 Alignment & Distribution (Layer)
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Align Left | InspectorPanel > Align Section | 2개 이상 레이어 |
| Align Center H | InspectorPanel > Align Section | |
| Align Right | InspectorPanel > Align Section | |
| Align Top | InspectorPanel > Align Section | |
| Align Center V | InspectorPanel > Align Section | |
| Align Bottom | InspectorPanel > Align Section | |
| Distribute H | InspectorPanel > Align Section | 3개 이상 |
| Distribute V | InspectorPanel > Align Section | 3개 이상 |

### 1.6 Layer Management
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Layer List | LayerPanel (좌측 패널) | 트리 뷰 |
| Layer Visibility Toggle | LayerPanel (Eye 아이콘) | 레이어별 |
| Layer Role (primary/secondary/tertiary) | InspectorPanel (read-only) | 색상 도트 |
| Clip Mask 설정 | InspectorPanel > Clipping Section | 다중 선택 시 |
| Clip Mask 해제 | InspectorPanel > Release Clipping | 단일 선택 시 |
| Layer Arrange (순서) | layer-arrange.ts | Bring to front 등 |
| Group | — | 코드에 groupId 존재하나 UI 미노출 |

### 1.7 Style Properties
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Fill Color | InspectorPanel > Style Section | PaintField 컴포넌트 |
| Fill: Solid Color | PaintField | 색상 피커 |
| Fill: Linear Gradient | PaintField | 스탑 편집 |
| Fill: Radial Gradient | PaintField | 스탑 편집 |
| Fill: currentColor | PaintField | 토큰 모드 |
| Fill: None | PaintField | |
| Stroke Color | InspectorPanel > Style Section | PaintField |
| Stroke Width | InspectorPanel > Style Section | NumberField |
| Line Cap (butt/round/square) | InspectorPanel > Style Section | SelectField |
| Line Join (miter/round/bevel) | InspectorPanel > Style Section | SelectField |
| Fill Opacity | InspectorPanel > Style Section | 0–1, step 0.05 |
| Stroke Opacity | InspectorPanel > Style Section | 0–1, step 0.05 |
| Fill Rule (nonzero/evenodd) | InspectorPanel > Path Section | read-only |

### 1.8 Variant System
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Variant List | InspectorPanel > Variants Section | 버튼 리스트 |
| Add Variant (preset sizes) | InspectorPanel > Variants Section | 12–48px |
| Remove Variant | InspectorPanel > Variants Section | |
| Weight (9단계) | InspectorPanel > Variants Section | ultralight~black |
| Scale (3단계) | InspectorPanel > Variants Section | small/medium/large |
| Generate Variant Matrix | InspectorPanel > Variants Section | Size×Weight×Scale |
| Variant Picker Bar | Canvas 상단 바 | 현재 variant 전환 |
| Rendering Mode | Toolbar dropdown | mono/hierarchical/multicolor/palette |

### 1.9 State Machine
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| State List | Canvas 상단 State Manager Bar | 버튼 바 |
| Add State (duplicate/blank) | State Manager Bar popover | |
| Delete State | State Manager Bar | |
| Rename State | State Manager Bar popover | |
| Default State 설정 | store action | UI 미확인 |

### 1.10 Transitions & Morphing
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Transition List | TransitionPanel (우측) | from→to 목록 |
| Add/Remove Transition | TransitionPanel | |
| Duration (ms) | TransitionPanel | |
| Easing Curve | EasingPicker / BezierCurveEditor | cubic-bezier + spring |
| Morph Strategy | TransitionPanel | bestGuess/strict/crossfade |
| Layer Binding | TransitionPanel | offset config |
| Stagger Mode | TransitionPanel | linear/center/edges/random |
| Trigger Events | TriggerEditor | hover/tap/longPress/focus/auto |
| Topology Lock | InspectorPanel > Topology Section | |
| Morph Readiness | MorphReadinessIndicator | |
| Transition Preview | TransitionPanel | play/pause/scrub |
| Speed Multiplier | TransitionPanel | 0.25x–2x |

### 1.11 Animation Effects
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Bounce | AnimationStudioPanel | scale 프리셋 |
| Pulse | AnimationStudioPanel | rhythmic scale |
| Wiggle | AnimationStudioPanel | rotation |
| Rotate | AnimationStudioPanel | continuous |
| Breathe | AnimationStudioPanel | scale in/out |
| Draw On | AnimationStudioPanel | path reveal |
| Draw Off | AnimationStudioPanel | path hide |
| Appear | AnimationStudioPanel | opacity+scale |
| Disappear | AnimationStudioPanel | opacity-out |
| Variable Color | AnimationStudioPanel | palette cycling |
| Custom Effect | CustomEffectBuilder | |
| Effect Speed | AnimationStudioPanel | 0.25x–2x |
| Effect Loop | AnimationStudioPanel | toggle |

### 1.12 Timeline
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Keyframe Timeline | TimelineEditor | transition 선택 시 |
| Property Tracks | TimelineEditor | opacity/rotate/translate/scale/pathLength/fill/stroke |
| Playhead Scrub | TimelineEditor | drag to scrub |
| Keyframe CRUD | TimelineEditor | |

### 1.13 Guides & Snapping
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Guide Master Presets | GuideMasterPanel (좌측 패널 Guides 탭) | 12–48pt |
| Custom Guide Master | GuideMasterPanel | |
| Guide Items (rect/ellipse/hline/vline/drawPoint) | GuideMasterPanel | |
| Custom Guides per Icon | Canvas | icon.customGuides |
| Rulers (top/left) | Canvas overlay | |
| Ruler Guide Drag | Rulers component | 드래그로 가이드 생성 |
| Snap Toggle | ToolPanel | On/Off |
| Snap Targets | snap-engine.ts | grid/guide/edge/center/anchor |
| Snap Tolerance | snap-engine.ts | 기본 3px |
| Guide Visibility | store toggle | |
| Guide Style (subtle/strong) | store | |

### 1.14 Viewport & Navigation
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Zoom (0.1x–32x) | Toolbar + Canvas wheel | Ctrl+Wheel |
| Pan | Canvas (Space+Drag) | |
| Fit to Content | Toolbar button | |
| Zoom In/Out Buttons | Toolbar | |

### 1.15 Import
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Raw SVG Paste | ImportIconDialog | 텍스트 입력 |
| SVG File Upload | ImportIconDialog | 파일 선택 |
| Lucide Icon Import | ImportIconDialog → API | 검색+선택 |
| SVG Drag & Drop | Canvas | 캔버스에 드래그 |
| SVG Normalize | import pipeline | 자동 정규화 |
| SVG Sanitize | import pipeline | 보안 정제 |

### 1.16 Export
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| SVG File | Toolbar > Download dropdown | |
| SVG Package | Toolbar > Download dropdown | |
| React Component Library | Toolbar > Download dropdown | ZIP |
| Runtime JSON | Toolbar > Download dropdown | |
| Storybook Stories | export pipeline | 자동 생성 |
| Swift/iOS Export | GitHub Sync | |
| Flutter Export | GitHub Sync | |
| Web Component Export | GitHub Sync | |

### 1.17 GitHub Sync
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| PR Creation | SyncPrPanel | |
| Conflict Resolution | SyncConflictPanel | three-way merge |
| Diff Preview | SyncDiffPreview | |
| Multi-target Config | SyncTargetPanel | React/Swift/Flutter/WebComponent |
| Branch Config | GitHubSyncPanel | |

### 1.18 Project Management
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| New Project | Toolbar / Explorer | |
| Open Project | Toolbar | |
| Save Project | Toolbar | dirty indicator |
| Recent Projects | Explorer | |
| Icon CRUD | Explorer / Toolbar | create/rename/duplicate/delete |
| Icon Search | Explorer | |
| Favorites | Explorer | star toggle |
| Collections | schema에 존재 | UI 미확인 |

### 1.19 Component System
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Tag Badge | InspectorPanel > Components Section | |
| Tag Slash | InspectorPanel > Components Section | |
| Tag Enclosure | InspectorPanel > Components Section | |
| Component Linkage Display | LayerPanel | 아이콘 표시 |

### 1.20 History
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Undo (Cmd+Z) | Toolbar button + keyboard | |
| Redo (Cmd+Shift+Z) | Toolbar button + keyboard | |
| History Pause/Resume | internal | 드래그 배치 |

### 1.21 Keyboard Shortcuts
| Feature | 현재 위치 | 비고 |
|---------|-----------|------|
| Tool Switching (V/A/P/U/G) | global | |
| Undo/Redo | global | |
| Copy/Paste | global | |
| Select All | global | |
| Zoom | global | |
| Space for Pan | Canvas | |
| Delete | Canvas | |

---

## 2. 현재 구조의 문제점 (UX Audit)

### 2.1 캔버스 중심성 부족
- **캔버스가 UI의 중심이 아님**: Variant Picker, State Manager 바가 캔버스 위에 겹쳐 있어 작업 공간 침식
- **도큐먼트 메타데이터**(breadcrumb, icon name, variant/state ID)가 좌측 패널 상단에 과도하게 표시
- **Canvas Status Strip**이 캔버스 위에 겹쳐 정보 중복 (Toolbar와 Status Strip에 같은 정보)

### 2.2 패널 정보 밀도 문제
- **InspectorPanel이 82KB, 1800+ 줄** — 모든 속성이 하나의 스크롤에 flat하게 나열
- Variants, Components, Topology, Shape Settings, Layer Info, Clipping, Boolean, Align, Path, Style, Vector, Transform이 모두 한 패널에
- 전문 툴에서는 이들이 각각 분리된 섹션/패널로 존재

### 2.3 기능 접근성 (Depth) 문제
- **Boolean Ops**: 레이어 2개 선택 후 InspectorPanel 스크롤해야 접근 → 메뉴/단축키가 더 자연스러움
- **Alignment**: 역시 InspectorPanel 깊숙이 위치
- **Variant 관리**: 속성 패널 안에 있어 프로젝트 구조와 혼재
- **Rendering Mode**: Toolbar dropdown에 있으나 Variant와 연관된 기능

### 2.4 캔버스 밖 요소 편집 불가
- 캔버스 viewBox 밖 영역의 패스가 보이되 편집 불가
- 전문 디자인 툴은 artboard 밖 영역도 자유롭게 편집 가능

### 2.5 좌측 패널
- Layers와 Guides가 하나의 탭에 공존 — 동시 접근 불가
- Layer 정보가 빈약 (이름, 역할 도트, visibility만)
- 레이어 드래그 순서 변경 없음
- 레이어 이름 편집 없음
- 레이어 잠금(Lock) 없음

### 2.6 우측 패널
- Inspector vs Animation 탭 전환 — 동시 접근 불가
- Inspector 내 섹션이 context에 따라 show/hide되어 예측 불가
- Transition/Timeline이 별도 패널이 아니라 탭 내부에 매몰

---

## 3. 전문 디자인 툴 레퍼런스 IA 패턴

### 3.1 Figma
```
┌─ Menu Bar ─────────────────────────────────────────────┐
├─ Toolbar (horizontal, top) ───────────────────────────┤
│  Move | Scale | Frame | Shape▼ | Pen | Text | ...     │
├────────┬──────────────────────────┬───────────────────┤
│ Left   │     CANVAS (central)     │ Right Panel       │
│ Panel  │                          │                   │
│        │                          │ Design | Proto    │
│ Layers │                          │ ─────────────     │
│ Assets │                          │ Alignment         │
│ Pages  │                          │ Auto Layout       │
│        │                          │ Frame (W/H/X/Y)   │
│        │                          │ Rotation           │
│        │                          │ Corner Radius      │
│        │                          │ Fill               │
│        │                          │ Stroke             │
│        │                          │ Effects            │
│        │                          │ Export             │
└────────┴──────────────────────────┴───────────────────┘
```
**핵심 원칙:**
- 캔버스가 절대적 중심 (artboard 밖도 편집 가능)
- 좌측: 구조(Layers/Pages/Assets) — 항상 보임
- 우측: 선택된 오브젝트의 속성 — 섹션별 분리, 접히는 구조
- 상단: 도구 + 뷰 컨트롤 — 1단 수평 배열
- Boolean, Alignment은 상단 toolbar에 context-aware로 노출
- Prototype/Design 탭은 같은 패널에서 모드 전환

### 3.2 Glyphs 3
```
┌─ Menu Bar ─────────────────────────────────────────────┐
├─ Toolbar (horizontal) ────────────────────────────────┤
│  Select | Draw | Other Shapes | Measure | Zoom | ...  │
├────────┬──────────────────────────┬───────────────────┤
│ Font   │     CANVAS (central)     │ Inspector         │
│ View   │     with metrics guides  │ (context-aware)   │
│        │                          │                   │
│ Glyph  │  ← overflows allowed →  │ Dimensions        │
│ List   │                          │ Transformations   │
│        │                          │ Node Info         │
│ Smart  │                          │ Alignment         │
│ Filter │                          │                   │
│        │                          │ Palette (colors)  │
│        ├──────────────────────────┤                   │
│        │ Preview (bottom strip)   │                   │
└────────┴──────────────────────────┴───────────────────┘
```
**핵심 원칙:**
- 캔버스는 glyph 범위 밖도 자유롭게 편집 가능
- 좌측: 글리프 목록 + 스마트 필터 (프로젝트 구조)
- 우측: Inspector (선택 항목에 따른 context-aware 속성)
- 하단: Preview strip (여러 글리프를 조합한 미리보기)
- 메트릭, 가이드라인은 캔버스 위 반투명 오버레이

### 3.3 SF Symbols (참고)
- 심볼별 여러 Weight/Scale variant 관리
- 렌더링 모드별 레이어 역할 (primary/secondary/tertiary)
- Variant Matrix 구조: Size × Weight × Scale × Rendering Mode

---

## 4. 제안 IA (Information Architecture)

### 4.1 전체 구조

```
┌─ Title Bar (desktop) ──────────────────────────────────────────────┐
│  [IconStudio]  project_name — icon_name                            │
├─ Menu Bar ─────────────────────────────────────────────────────────┤
│  File  Edit  View  Layer  Path  Arrange  Animation  Window  Help   │
├─ Toolbar ──────────────────────────────────────────────────────────┤
│  [Select▼][Pen][Shape▼] | [Boolean▼][Align▼] | [Zoom][Fit]        │
│                          | [Undo][Redo]       | [Snap][Guides]     │
├───────────┬────────────────────────────────────┬───────────────────┤
│  LEFT     │         CANVAS (center)            │  RIGHT            │
│  SIDEBAR  │                                    │  SIDEBAR          │
│  (240px)  │    ┌──── viewBox ────┐             │  (280px)          │
│           │    │                 │             │                   │
│ ┌───────┐ │    │   editable      │             │ ┌───────────────┐ │
│ │Icon   │ │    │   artwork       │             │ │ DESIGN TAB    │ │
│ │List   │ │    │                 │             │ │               │ │
│ │       │ │    └─────────────────┘             │ │ Transform     │ │
│ │       │ │    ← overflow editable →           │ │ ├ X, Y        │ │
│ ├───────┤ │                                    │ │ ├ W, H        │ │
│ │Layers │ │                                    │ │ ├ Rotation    │ │
│ │       │ │    Rulers (top + left)             │ │ ├ Scale       │ │
│ │ list  │ │    Snap guides (overlay)           │ │               │ │
│ │ w/    │ │                                    │ │ Fill          │ │
│ │ drag  │ │                                    │ │ ├ Color/Grad  │ │
│ │ re-   │ │                                    │ │ ├ Opacity     │ │
│ │ order │ │                                    │ │               │ │
│ │       │ │                                    │ │ Stroke        │ │
│ └───────┘ │                                    │ │ ├ Color       │ │
│           │                                    │ │ ├ Width       │ │
│           │                                    │ │ ├ Cap/Join    │ │
│           │                                    │ │ ├ Opacity     │ │
│           │                                    │ │               │ │
│           │                                    │ │ Point (ctx)   │ │
│           │                                    │ │ ├ Position    │ │
│           │                                    │ │ ├ Handles     │ │
│           │                                    │ │ ├ Node Type   │ │
│           │                                    │ │ ├ Radius      │ │
│           │                                    │ │               │ │
│           │                                    │ │ Layer         │ │
│           │                                    │ │ ├ Role        │ │
│           │                                    │ │ ├ Clip Mask   │ │
│           │                                    │ │ ├ Fill Rule   │ │
│           │                                    │ │               │ │
│           │                                    │ │ Components    │ │
│           │                                    │ │ ├ Badge/Slash │ │
│           │                                    │ └───────────────┘ │
│           │                                    │                   │
│           │                                    │ ┌───────────────┐ │
│           │                                    │ │ ANIMATE TAB   │ │
│           │                                    │ │               │ │
│           │                                    │ │ Transitions   │ │
│           │                                    │ │ Effects       │ │
│           │                                    │ │ Triggers      │ │
│           │                                    │ │ Morph Config  │ │
│           │                                    │ └───────────────┘ │
├───────────┴────────────────────────────────────┴───────────────────┤
│  BOTTOM BAR                                                        │
│  ┌─ Variant Strip ──────────────────────┬─ State Strip ──────────┐ │
│  │ [24px] [32px] [48px] [+]            │ [default][active][+]   │ │
│  └──────────────────────────────────────┴────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│  TIMELINE PANEL (collapsible, drag-resize)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ▶ [0:00]──────────────────[0:30] | Transition: default→active │
│  │ opacity    ●─────────────────●                               │  │
│  │ rotate     ●──────●                                          │  │
│  │ translateX ●─────────●                                       │  │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 메뉴 바 (Menu Bar)

```
File
├── New Project                    Cmd+N
├── Open Project...                Cmd+O
├── Open Recent                    ▶
├── ─────────────
├── Save                           Cmd+S
├── Save As...                     Cmd+Shift+S
├── ─────────────
├── Import SVG...                  Cmd+I
├── Import from Lucide...
├── ─────────────
├── Export                         ▶
│   ├── SVG File...                Cmd+E
│   ├── SVG Package...
│   ├── React Components...
│   ├── Runtime JSON...
│   └── Storybook Stories...
├── ─────────────
├── GitHub Sync...
└── Close                          Cmd+W

Edit
├── Undo                           Cmd+Z
├── Redo                           Cmd+Shift+Z
├── ─────────────
├── Cut                            Cmd+X
├── Copy                           Cmd+C
├── Paste                          Cmd+V
├── Duplicate                      Cmd+D
├── Delete                         ⌫
├── Select All                     Cmd+A
├── ─────────────
├── Copy SVG Path
└── Paste SVG Path

View
├── Zoom In                        Cmd+=
├── Zoom Out                       Cmd+-
├── Zoom to Fit                    Cmd+0
├── Zoom to 100%                   Cmd+1
├── ─────────────
├── Show Rulers                    Cmd+R
├── Show Guides                    Cmd+'
├── Show Grid
├── Guide Style                    ▶
│   ├── Subtle
│   └── Strong
├── ─────────────
├── Rendering Mode                 ▶
│   ├── Multicolor
│   ├── Monochrome
│   ├── Hierarchical
│   └── Palette
├── ─────────────
├── Toggle Left Sidebar            Cmd+[
├── Toggle Right Sidebar           Cmd+]
├── Toggle Timeline                Cmd+T
└── Toggle Bottom Bar              Cmd+B

Layer
├── Add Layer
├── Delete Layer
├── ─────────────
├── Rename Layer                   Cmd+R (focus)
├── Lock Layer                     Cmd+L
├── Hide Layer                     Cmd+H (layer)
├── ─────────────
├── Group Layers                   Cmd+G
├── Ungroup                        Cmd+Shift+G
├── ─────────────
├── Make Clipping Mask
├── Release Clipping Mask
├── ─────────────
├── Tag as Component               ▶
│   ├── Badge
│   ├── Slash
│   └── Enclosure
├── ─────────────
├── Set Role                       ▶
│   ├── Primary
│   ├── Secondary
│   ├── Tertiary
│   └── None

Path
├── Join Paths
├── Break Apart
├── ─────────────
├── Boolean Operation              ▶
│   ├── Unite                      Cmd+Alt+U
│   ├── Subtract                   Cmd+Alt+S
│   ├── Intersect                  Cmd+Alt+I
│   └── Exclude                    Cmd+Alt+X
├── ─────────────
├── Reverse Path Direction
├── Simplify Path
├── ─────────────
├── Node Type                      ▶
│   ├── Corner
│   ├── Smooth
│   ├── Mirror Angle
│   └── Symmetric

Arrange
├── Bring to Front                 Cmd+Shift+↑
├── Bring Forward                  Cmd+↑
├── Send Backward                  Cmd+↓
├── Send to Back                   Cmd+Shift+↓
├── ─────────────
├── Align                          ▶
│   ├── Left
│   ├── Center Horizontal
│   ├── Right
│   ├── Top
│   ├── Center Vertical
│   └── Bottom
├── Distribute                     ▶
│   ├── Horizontally
│   └── Vertically

Animation
├── Add State...
├── Duplicate State
├── Delete State
├── Rename State...
├── ─────────────
├── Add Transition...
├── Edit Transition...
├── ─────────────
├── Add Effect...
├── Custom Effect...
├── ─────────────
├── Play/Pause Preview             Space (in timeline)
├── ─────────────
├── Lock Topology
├── Unlock Topology

Window
├── Guide Master                   Cmd+Shift+G
├── Variant Manager
├── GitHub Sync
├── ─────────────
├── Minimize
└── Bring All to Front
```

### 4.3 상단 Toolbar (Context-Aware)

```
[Tool Group]                [Action Group]              [View Group]
┌──────────────────┐  ┌───────────────────────┐  ┌──────────────────┐
│ Select▼ Pen Shape▼│  │ Undo Redo │ Boolean▼  │  │ Zoom- % Zoom+ Fit│
│                  │  │           │ Align▼    │  │ Snap Guides      │
└──────────────────┘  └───────────────────────┘  └──────────────────┘

Context-aware 동작:
- 2+ 레이어 선택 시: Boolean▼ 와 Align▼ 활성화
- 포인트 선택 시: Point Align 표시, Node Type▼ 추가
- Shape 도구 활성 시: Shape 옵션 (sides, points) 인라인 표시
```

### 4.4 좌측 사이드바 (Left Sidebar — 구조 & 탐색)

```
LEFT SIDEBAR (240px, resizable)
═══════════════════════════════

┌─ ICON LIST (collapsible) ──────────┐
│ 🔍 Search...              [+ New]  │
│                                    │
│ ▸ icon-arrow-right        ★       │
│ ▸ icon-check              ★       │
│ ▸ icon-close                       │
│ ▸ icon-menu                        │
│ ▸ icon-search                      │
│                                    │
│ ← Explorer에서 온 아이콘 목록       │
│   편집 중 아이콘 간 빠른 전환용      │
└────────────────────────────────────┘

┌─ LAYERS ───────────────────────────┐
│ Structure                 [+ Add]  │
│                                    │
│ ┌─ Drag handle ─────────────────┐  │
│ │ ● path-1 (primary)    👁 🔒   │  │
│ │   └ clipped by path-3         │  │
│ │ ● path-2 (secondary)  👁 🔒   │  │
│ │ ● path-3 [mask]       👁 🔒   │  │
│ └───────────────────────────────┘  │
│                                    │
│ Features:                          │
│ - Drag reorder (순서 변경)          │
│ - Double-click rename (이름 편집)   │
│ - Visibility toggle (👁)           │
│ - Lock toggle (🔒)                 │
│ - Role color dot (●)              │
│ - Clip mask indicator              │
│ - Component badge                  │
│ - Context menu (right-click)       │
│   ├ Rename                         │
│   ├ Duplicate                      │
│   ├ Delete                         │
│   ├ Set Role ▶                     │
│   ├ Arrange ▶                      │
│   └ Make Clipping Mask             │
└────────────────────────────────────┘
```

**레퍼런스 근거:**
- Figma: Layers panel은 항상 좌측에 고정, 드래그 순서 변경, 인라인 rename
- Glyphs: 좌측에 glyph list + 레이어 구조
- Icon List는 Figma의 Pages 개념과 유사

### 4.5 우측 사이드바 (Right Sidebar — 속성 & 애니메이션)

```
RIGHT SIDEBAR (280px, resizable)
═══════════════════════════════

┌─ TAB BAR ──────────────────────┐
│  [ Design ]  [ Animate ]       │
└────────────────────────────────┘

════ DESIGN TAB ═════════════════

┌─ TRANSFORM (always visible) ──┐
│ X [___120__]  Y [___80___]    │
│ W [___24___]  H [___24___]    │
│ ↻ [___0°___]                  │
│ ─────────────────────────     │
│ Scale X [1.0]  Scale Y [1.0]  │
└───────────────────────────────┘

┌─ FILL (collapsible ▼) ────────┐
│ ● [#1a1a1a]  ◐ 100%          │
│ Mode: [Solid ▼]               │
│   Solid | Linear | Radial |   │
│   currentColor | None         │
│                               │
│ (gradient editor if gradient)  │
│ ├──●────●────●──  stops       │
│ └───────────────────────────  │
└───────────────────────────────┘

┌─ STROKE (collapsible ▼) ──────┐
│ ● [#000000]  ◐ 100%          │
│ Width [__2__]                 │
│ Cap [Round ▼]  Join [Miter ▼] │
└───────────────────────────────┘

┌─ POINT (context, collapsible) ┐
│ ▸ Visible when points selected │
│                               │
│ Position  X [__]  Y [__]      │
│ Handle In  X [__]  Y [__]     │
│ Handle Out X [__]  Y [__]     │
│                               │
│ Node: [○corner][○smooth]      │
│       [○mirror][○symmetric]   │
│                               │
│ Radius [__0__] ⌒              │
└───────────────────────────────┘

┌─ LAYER PROPERTIES (collapsible)┐
│ Name [____________]           │
│ Role [Primary ▼]              │
│ Fill Rule [nonzero ▼]         │
│ Clip Mask [None ▼]            │
└───────────────────────────────┘

┌─ COMPONENTS (collapsible) ────┐
│ [Badge] [Slash] [Enclosure]   │
│ Active: Badge (2 layers)      │
│ [Remove]                      │
└───────────────────────────────┘

┌─ EXPORT (collapsible ▼) ──────┐
│ Quick export options:          │
│ [SVG] [React] [Copy SVG]      │
│ "Export All..." link           │
└───────────────────────────────┘

════ ANIMATE TAB ════════════════

┌─ STATES ──────────────────────┐
│ States (3)            [+ Add] │
│ ● default (current)          │
│ ○ active                     │
│ ○ disabled                   │
└───────────────────────────────┘

┌─ TRANSITIONS ─────────────────┐
│ Transitions (2)       [+ Add] │
│                               │
│ ┌ default → active ────────┐  │
│ │ Duration: [300ms]        │  │
│ │ Easing: [ease-in-out ▼]  │  │
│ │ Strategy: [bestGuess ▼]  │  │
│ │ Trigger: [hover ▼]       │  │
│ │ [Edit Bindings]          │  │
│ │ Stagger: [linear ▼]     │  │
│ └──────────────────────────┘  │
│                               │
│ ┌ active → default ────────┐  │
│ │ ...                      │  │
│ └──────────────────────────┘  │
└───────────────────────────────┘

┌─ EFFECTS ─────────────────────┐
│ Effects Library       [+ Add] │
│                               │
│ ┌ bounce ──────────────────┐  │
│ │ ▶ Preview  ⚙ Config      │  │
│ └──────────────────────────┘  │
│                               │
│ ┌ drawOn ──────────────────┐  │
│ │ ▶ Preview  ⚙ Config      │  │
│ └──────────────────────────┘  │
│                               │
│ [Browse Presets...]            │
│ [Custom Effect...]             │
└───────────────────────────────┘

┌─ TOPOLOGY ────────────────────┐
│ Morph Readiness: ✓ Compatible │
│ Tracked Layers: 3             │
│ Status: [Locked 🔒]           │
│ [Lock] [Unlock]               │
└───────────────────────────────┘
```

### 4.6 하단 바 (Bottom Bar — Variant & State Strip)

```
BOTTOM BAR (fixed, thin strip above timeline)
═══════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ Variants: [12px][16px][20px][●24px][32px][48px] [+]     │
│ Rendering: [Multi▼]  Weight: [Regular▼]  Scale: [M▼]   │
│ ──────────────────────────────────────────────────────── │
│ States: [●default] [active] [disabled] [+]              │
└─────────────────────────────────────────────────────────┘

설계 의도:
- Glyphs 3의 하단 preview strip 컨셉
- 현재 variant/state를 캔버스 위가 아닌 하단에 배치
- 캔버스 작업 공간을 침범하지 않음
- 빠른 전환에 항상 접근 가능
```

### 4.7 하단 Timeline Panel (Collapsible)

```
TIMELINE PANEL (collapsible, drag-resize height)
════════════════════════════════════════════════

┌─ Timeline Header ────────────────────────────────────┐
│ ▶ Pause  [0:00]────scrubber────[0:30]  Speed: [1x▼] │
│ Transition: default → active                         │
├──────────────────────────────────────────────────────┤
│ Layer Tracks:                                        │
│                                                      │
│ path-1  opacity    ●─────────────────●               │
│         rotate     ●──────●                          │
│         translateX ●─────────●                       │
│                                                      │
│ path-2  opacity    ●───────────────────●             │
│         scale      ●─────────●                       │
│                                                      │
│ [+ Add Track]                                        │
└──────────────────────────────────────────────────────┘

설계 의도:
- After Effects, Figma Prototype의 timeline과 유사
- 캔버스와 분리된 독립 패널로, 높이 조절 가능
- 접으면 완전히 숨겨져 캔버스 공간 최대화
```

---

## 5. Feature Depth Map (기능별 접근 깊이)

### Level 0 — 항상 보임 (Always Visible)
| Feature | 위치 |
|---------|------|
| Active Tool indicator | Toolbar |
| Canvas + Rulers | Center |
| Layer list | Left Sidebar |
| Zoom level | Toolbar |
| Snap status | Toolbar |
| Current variant/state | Bottom Bar |

### Level 1 — 1클릭 (Single Click/Hover)
| Feature | 위치 | 트리거 |
|---------|------|--------|
| Tool 전환 | Toolbar | click |
| Undo/Redo | Toolbar | click |
| Layer visibility | Left Sidebar | eye icon click |
| Layer lock | Left Sidebar | lock icon click |
| Layer select | Left Sidebar/Canvas | click |
| Variant 전환 | Bottom Bar | click |
| State 전환 | Bottom Bar | click |
| Zoom in/out | Toolbar | click or Cmd+scroll |
| Fit to content | Toolbar | click |
| Pan | Canvas | Space+drag |
| Snap toggle | Toolbar | click |
| Guide visibility | Toolbar | click |
| Design/Animate 탭 전환 | Right Sidebar tab | click |

### Level 2 — 선택 후 노출 (Selection-Contextual)
| Feature | 위치 | 조건 |
|---------|------|------|
| Transform (X/Y/W/H/R) | Right > Design > Transform | 레이어 선택 |
| Fill 속성 | Right > Design > Fill | 레이어 선택 |
| Stroke 속성 | Right > Design > Stroke | 레이어 선택 |
| Point 속성 | Right > Design > Point | 포인트 선택 |
| Node type | Right > Design > Point | 포인트 선택 |
| Layer properties | Right > Design > Layer | 레이어 선택 |
| Boolean ops | Toolbar (enabled) | 2+ path 레이어 |
| Alignment | Toolbar (enabled) | 2+ 레이어 |
| Clipping mask | Context menu / Menu | 2+ 레이어 |
| Shape settings (sides, points) | Toolbar inline | Shape 도구 활성 |

### Level 3 — 명시적 열기 (Explicit Open)
| Feature | 위치 | 접근 방식 |
|---------|------|-----------|
| Boolean ops 상세 | Path 메뉴 | 메뉴 or 단축키 |
| Alignment 전체 | Arrange 메뉴 | 메뉴 |
| Import SVG dialog | File 메뉴 or Cmd+I | 메뉴/단축키 |
| Export options | File > Export | 메뉴 |
| Guide Master 설정 | Window 메뉴 or Cmd+Shift+G | 별도 패널/다이얼로그 |
| Variant Manager | Window 메뉴 | 별도 패널 |
| Transition 상세편집 | Right > Animate > Transition card | 카드 확장 |
| Easing curve editor | Transition 카드 내 | easing 클릭 |
| Timeline | Bottom (toggle) | Cmd+T or 전환 선택 시 |
| Effect browser | Right > Animate > Effects | Browse 클릭 |
| Custom effect builder | Right > Animate > Effects | Custom 클릭 |
| GitHub Sync | Window 메뉴 / File > GitHub Sync | 별도 다이얼로그 |
| Variant Matrix 생성 | Variant Manager 내 | 별도 패널 |
| Topology 관리 | Right > Animate > Topology | |

### Level 4 — 드물게 접근 (Rare/Settings)
| Feature | 위치 | 접근 방식 |
|---------|------|-----------|
| Project settings | File 메뉴 | 다이얼로그 |
| Stagger mode | Transition 상세편집 내 | 드롭다운 |
| Layer binding (morph) | Transition 상세편집 내 | 확장 영역 |
| Speed multiplier | Timeline header / Effect card | 드롭다운 |
| Fill rule 변경 | Layer Properties > Fill Rule | 드롭다운 |
| Rendering mode | Bottom Bar or View 메뉴 | 드롭다운 |
| Weight/Scale variant | Bottom Bar or Variant Manager | 드롭다운 |
| Guide style | View > Guide Style | 서브메뉴 |

---

## 6. 캔버스 밖 편집 가능 범위 (Canvas Overflow Policy)

### 현재 문제
- viewBox 경계에서 클리핑되어 밖의 패스가 편집 불가

### 제안 정책 (Figma/Glyphs 참조)
```
┌──────────────────────────────────────────────┐
│                   Canvas Viewport            │
│                                              │
│     ┌──────── viewBox ────────┐              │
│     │  ┌───────────────────┐  │              │
│     │  │  EXPORTED AREA    │  │              │
│     │  │  (clipped on      │  │              │
│     │  │   export)         │  │              │
│     │  └──────────┐        │  │              │
│     │             │ path   │  │              │
│     └─────────────┼────────┘  │              │
│                   │ ← overflow│              │
│                   │  EDITABLE │              │
│                   │  but NOT  │              │
│                   │  exported │              │
│                   └───────────│              │
│                                              │
│  Rule: viewBox 경계선을 시각적으로 표시        │
│        (dashed line, dimmed outer area)       │
│        밖의 패스도 선택, 이동, 편집 가능        │
│        Export 시에는 viewBox 기준 클리핑        │
└──────────────────────────────────────────────┘
```

---

## 7. 현재 → 제안 이동 매핑 (Migration Map)

| 기능 | 현재 위치 | 제안 위치 | 변경 이유 |
|------|-----------|-----------|-----------|
| Undo/Redo | Toolbar (현 유지) | Toolbar | ✓ 적절 |
| Tool Selection | ToolPanel (좌측 독) | Toolbar (수평) | Figma 패턴, 수평이 공간 효율적 |
| Shape sub-tools | ToolPanel popover | Toolbar dropdown | 통합 |
| Shape settings (sides/pts) | InspectorPanel | Toolbar inline (context) | 도구 옵션은 도구 근처에 |
| Zoom controls | Toolbar (현 유지) | Toolbar | ✓ 적절 |
| Snap toggle | ToolPanel 하단 | Toolbar | 더 빠른 접근 |
| Guide visibility | store만 | Toolbar toggle | 즉시 접근 가능해야 |
| Boolean operations | InspectorPanel 깊숙이 | Toolbar context + Path 메뉴 | 즉시 접근 |
| Alignment | InspectorPanel 깊숙이 | Toolbar context + Arrange 메뉴 | 즉시 접근 |
| Distribution | InspectorPanel 깊숙이 | Arrange 메뉴 | |
| Point Align/Distribute | InspectorPanel > Vector | Toolbar context (포인트 모드) | |
| Variant Picker | Canvas 상단 (겹침) | Bottom Bar | 캔버스 해방 |
| State Manager | Canvas 상단 (겹침) | Bottom Bar | 캔버스 해방 |
| Variant 속성 (weight/scale) | InspectorPanel | Bottom Bar dropdown | 바리언트와 함께 |
| Rendering Mode | Toolbar dropdown | Bottom Bar (variant 옆) | variant와 연관 |
| Transform (X/Y/R/S) | InspectorPanel > Transform | Right > Design > Transform | ✓ 적절 (정리) |
| Fill/Stroke | InspectorPanel > Style | Right > Design > Fill/Stroke | ✓ 적절 (분리) |
| Point editing | InspectorPanel > Vector | Right > Design > Point | ✓ 적절 (context) |
| Layer info | InspectorPanel | Right > Design > Layer Properties | |
| Components | InspectorPanel | Right > Design > Components | |
| Layer list | LayerPanel (좌측 탭) | Left Sidebar (항상 보임) | 탭 제거, 항상 접근 |
| Guide Master | 좌측 탭 (Layers와 공유) | 별도 플로팅 패널/다이얼로그 | |
| Icon List | 없음 (Explorer만) | Left Sidebar 상단 | 편집 중 아이콘 전환 |
| Animation Effects | Right > Animate 탭 | Right > Animate > Effects | ✓ 적절 |
| Transitions | TransitionPanel (복잡) | Right > Animate > Transitions | 정리 |
| Triggers | TriggerEditor | Right > Animate > Transition card 내 | 통합 |
| Timeline | TimelineEditor (탭 내부) | Bottom collapsible panel | 독립 패널로 승격 |
| Easing Picker | 별도 컴포넌트 | Transition card 내 inline | |
| Topology | InspectorPanel | Right > Animate > Topology | |
| Morph Readiness | 별도 indicator | Right > Animate > Topology | 통합 |
| GitHub Sync | 여러 컴포넌트 분산 | Window 메뉴 > 통합 다이얼로그 | |
| Export | Toolbar dropdown | File 메뉴 + Right > Design > Export (quick) | 이중 접근 |
| Import | Toolbar + Dialog | File 메뉴 + Cmd+I | |
| Document breadcrumb | 좌측 패널 상단 | Title Bar | 공간 절약 |
| Canvas Status Strip | Canvas 위 겹침 | 제거 (정보 중복) | Toolbar에 이미 있음 |
| Variant Matrix | InspectorPanel | Variant Manager (별도 패널) | |

---

## 8. 키보드 단축키 재설계

### Tier 1 — 필수 (매일 수십 번)
| 단축키 | 기능 |
|--------|------|
| V | Select Tool |
| A | Direct Select |
| P | Pen Tool |
| U | Shape Tool |
| Space+Drag | Pan |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Cmd+C / Cmd+V | Copy / Paste |
| Cmd+D | Duplicate |
| Delete / Backspace | Delete |
| Cmd+A | Select All |
| Cmd+= / Cmd+- | Zoom In / Out |
| Cmd+0 | Fit to Content |

### Tier 2 — 자주 (매일 수 번)
| 단축키 | 기능 |
|--------|------|
| Cmd+S | Save |
| Cmd+I | Import SVG |
| Cmd+E | Export SVG |
| Cmd+G / Cmd+Shift+G | Group / Ungroup |
| Cmd+L | Lock Layer |
| Cmd+[ / Cmd+] | Send Back / Bring Forward |
| Cmd+Shift+[ / ] | Send to Back / Bring to Front |
| Cmd+Alt+U | Boolean Unite |
| Cmd+Alt+S | Boolean Subtract |
| Cmd+Alt+I | Boolean Intersect |
| Cmd+Alt+X | Boolean Exclude |
| Tab | Cycle through layers |

### Tier 3 — 가끔 (주 수 번)
| 단축키 | 기능 |
|--------|------|
| Cmd+R | Toggle Rulers |
| Cmd+' | Toggle Guides |
| Cmd+T | Toggle Timeline |
| Cmd+1 | Zoom to 100% |
| Cmd+N | New Project |
| Cmd+O | Open Project |
| 1/2/3/4 | Node Type (Corner/Smooth/Mirror/Symmetric) |

---

## 9. 구현 우선순위 제안

### Phase 1 — 레이아웃 재구성 (캔버스 중심화)
1. Variant/State 바를 하단으로 이동
2. Canvas Status Strip 제거
3. 좌측 패널에서 탭 제거, Layers 항상 표시
4. InspectorPanel을 섹션별 collapsible 구조로 리팩터
5. Timeline을 하단 독립 패널로 분리

### Phase 2 — 캔버스 편집 범위 확장
1. viewBox 밖 영역 편집 가능하게
2. viewBox 경계 시각적 표시 (dimmed overlay)
3. Export 시에만 viewBox 기준 클리핑

### Phase 3 — Toolbar 재구성
1. Tool을 수평 toolbar로 이동
2. Context-aware Boolean/Align 버튼 추가
3. 메뉴 바 구현 (File/Edit/View/Layer/Path/Arrange/Animation)

### Phase 4 — Layer Panel 강화
1. 드래그 순서 변경
2. 인라인 이름 편집
3. Lock toggle 추가
4. Context menu 강화

### Phase 5 — 애니메이션 워크플로우 정리
1. Animate 탭 내부 구조 정리
2. Transition → Trigger → Timeline 워크플로우 자연스럽게
3. Effect browser를 라이브러리 형태로

---

*이 문서는 UI 디자인 착수 전 IA 레퍼런스로 사용됩니다.*
*기능 추가 없이 현재 기능만 재배치한 구조입니다.*
