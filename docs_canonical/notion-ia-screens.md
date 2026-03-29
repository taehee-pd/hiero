# Coniva — Information Architecture & Screen Inventory

## Product Overview

Coniva는 SF Symbols급 애니메이션 기능을 갖춘 아이콘 저작 도구입니다.
Next.js 16 + React 19 + TypeScript + Zustand + Tailwind CSS + Radix UI 기반.

---

## Information Architecture (IA)

### Top-Level Navigation

```
Coniva App
├── Explorer (/)                        ← 워크스페이스 & 프로젝트 관리
│   ├── Workspace View                  ← 아이콘 세트 그리드
│   ├── Project View                    ← 세트 내 아이콘 그리드
│   └── Distribution Panel              ← Sync/Export 타겟
│
├── Editor (/editor/[iconId])           ← 핵심 아이콘 편집
│   ├── Title Tab Bar                   ← 멀티 탭 (아이콘 전환)
│   ├── Toolbar                         ← 프로젝트명, Undo/Redo, Import/Export
│   ├── Left Sidebar (220px)
│   │   ├── Layers Tab                  ← 레이어 트리 + 가시성/잠금
│   │   └── Variants Tab                ← 사이즈 변형 + 상태 관리
│   ├── Canvas (center)
│   │   ├── SVG 편집 영역               ← 줌/팬, 가이드, 스냅
│   │   ├── Canvas Dock                 ← 도구 선택 (Select/Pen/Shape)
│   │   └── Status HUD                  ← 줌%, 좌표
│   └── Right Sidebar (260px)
│       ├── Inspect Tab
│       │   ├── Document Inspector      ← 이름, 캔버스 크기, 렌더링 모드
│       │   └── Layer Inspector         ← Fill, Stroke, Transform, Topology
│       └── Animation Tab
│           ├── Transitions             ← 상태 간 전환 정의
│           ├── Timeline Editor         ← 트랙별 키프레임 에디터
│           └── Preview                 ← 실시간 애니메이션 미리보기
│
└── Overlays (modals & popovers)
    ├── Import Dialog                   ← 7개 소스 탭 (SVG/Plugin/Figma/Libraries)
    ├── Export Sheet                    ← SVG/JSON/React/Lottie
    ├── Add Transition Dialog           ← Intra-variant / Cross-icon
    ├── Easing Curve Editor             ← 베지어 편집 + 프리셋
    ├── Color Picker                    ← HSB gradient + hex + swatches
    ├── Keyboard Shortcuts              ← 전체 단축키 레퍼런스
    ├── Sync Target Config              ← Local/GitHub/npm
    └── Confirmation Dialogs            ← Delete/Unsaved/Simple
```

---

## User Flow Map

```
[First Launch] → Explorer: Empty Workspace → "+ New Set" → Workspace View
                                            → "Import ▾" → Import Dialog

[Workspace View] → Click Set Card → Project View
                 → Search → Filtered Cards
                 → Right Click → Context Menu (Rename/Delete)

[Project View] → Click Icon → Editor (2A)
              → Multi-select → Bulk Actions (Categorize/Export/Delete)
              → "+ Icon" or Import → Import Dialog
              → Filter sidebar → Category/Collection/Favorites

[Editor] → Select Tool → Click layer → Layer Inspector (2F)
        → Pen Tool → Path editing (add/move/delete points)
        → Shape Tool → Draw Rectangle/Ellipse/Polygon/Star/Line
        → Left Sidebar → Switch Layers ↔ Variants tabs
        → Right Sidebar → Switch Inspect ↔ Animation tabs
        → Fill/Stroke → Color Picker (7)
        → Topology → Transition strategy
        → "+ Add Transition" → Add Transition Dialog (5)
        → Easing "Edit" → Easing Curve Editor (6)
        → Export ▾ → Export Sheet (4)
        → Tab bar → Switch between icons / back to Explorer
```

---

## Required Screens — Full List

### Screen 1: Explorer

| ID | Screen Name | Description | Key States |
|---|---|---|---|
| 1A | Workspace View | 아이콘 세트 카드 그리드 + 최근 프로젝트 | Empty / Normal / Search Active / Context Menu |
| 1B | Project View | 세트 내 아이콘 그리드 + 필터 사이드바 | Empty / Filtered / Multi-select + Bulk Bar |
| 1C | Distribution Panel | Sync 타겟 + Export 옵션 (right panel) | Local / GitHub / npm targets |

### Screen 2: Editor

| ID | Screen Name | Description | Key States |
|---|---|---|---|
| 2A | Full Editor Layout | 전체 에디터 조합 (Toolbar + Sidebar + Canvas + Inspector) | Clean / Dirty / Selection Active |
| 2B | Left Sidebar — Layers | 레이어 트리 (그룹, 중첩, 가시성, 잠금) | Empty / Selected / Multi-select / Drag Reorder |
| 2C | Left Sidebar — Variants | 사이즈 변형 + Derived + 상태 매트릭스 | Single Variant / Multi / States with Badges |
| 2D | Canvas — Tool Modes | Select / Pen / Shape 도구별 캔버스 상태 | Marquee / Point Edit / Shape Draw / Snap Guides |
| 2E | Right Sidebar — Inspect (No Selection) | Document-level 속성 (이름, 사이즈, 모드, 가이드) | Default |
| 2F | Right Sidebar — Inspect (Layer Selected) | Layer 속성 (Fill, Stroke, Transform, Topology) | Single Layer / Multi Layer |
| 2G | Right Sidebar — Animation | Transitions + Timeline + Preview | Empty / Transitions Listed / Playing |

### Screen 3–10: Overlays & Dialogs

| ID | Screen Name | Description | Key States |
|---|---|---|---|
| 3 | Import Dialog | 7개 탭 모달 (SVG, Plugin, Figma, Lucide, Hero, Phosphor, Material) | Per-tab states below |
| 3-SVG | Import: Raw SVG Tab | Paste SVG / Upload SVG 서브탭 | Empty / Pasted (preview) / Error |
| 3-Plugin | Import: Plugin Tab | Paste JSON / Upload JSON 서브탭 | Empty / Loaded / Importing / Done |
| 3-Figma | Import: Figma Tab | URL + Token → Connect → Component Grid | Pre-connected / Post-connected (grid browse) |
| 3-Library | Import: Library Tabs | 아이콘 이름 입력 + 배치 임포트 (max 50) | Empty / Results / Batch Progress |
| 4 | Export Sheet | 포맷 선택 (SVG/JSON/React/Lottie) + Lottie 진단 | Format Selected / Lottie Diagnostics |
| 5 | Add Transition Dialog | Intra-variant / Cross-icon 모드 전환 | Intra (From/To select) / Cross (Icon/Variant/State×2) |
| 6 | Easing Curve Editor | 베지어 핸들 + cubic-bezier 값 + 프리셋 | Custom Edit / Preset Selected |
| 7 | Color Picker | HSB gradient + Hue/Alpha slider + Hex + Swatches | Default / Alpha Active |
| 8 | Keyboard Shortcuts | 전체 단축키 그리드 (Tools/Edit/Canvas/Path/File) | Static |
| 9A | Sync: Local Directory | Path 입력 + Exclude 패턴 + Sync Now | Config / Syncing |
| 9B | Sync: GitHub PR | Owner/Repo + Branch + Create PR / Dry Run | Config / Creating |
| 9C | Sync: npm Registry | Package + Version + Bump + History | Config / Publishing |
| 10A | Confirm: Delete (exact name) | 이름 입력 필수 삭제 확인 | Empty / Name Matched |
| 10B | Confirm: Unsaved Changes | Don't Save / Cancel / Save 3버튼 | Static |
| 10C | Confirm: Simple | Cancel / Delete 2버튼 | Static |

---

## Component Inventory (for Figma & Implementation)

### Atoms (기본 컴포넌트)

| Component | Source File | Variants | Key Specs |
|---|---|---|---|
| Button | `button.tsx` | Default/Secondary/Destructive/Outline/Ghost/Link × Default/Sm/Lg/Icon | h-9(36px), rounded-md(6px), primary=#3186EE |
| Badge | `badge.tsx` | Default/Secondary/Destructive/Outline + Morph/Trim/Crossfade/Locked/Derived/Mask | rounded-md(6px), text-xs(12px) |
| TextInput | `input.tsx` | Default/Focused/Error/WithUnit | h-9(36px), rounded-md(6px), border rgba(0,0,0,0.10) |
| Select | `select.tsx` | Default/Focused/Sm | h-9(36px)/h-8(32px), chevron indicator |
| Switch | `switch.tsx` | On/Off | 18.4×32px, thumb 16px |
| Checkbox | `checkbox.tsx` | Checked/Unchecked | 16×16px, rounded-[4px] |
| Slider | `slider.tsx` | 0%/50%/100% | track h-1.5(6px), thumb 16px |
| Tabs | `tabs.tsx` | Active Tab 1/2/3 | list h-9(36px), p-[3px], rounded-lg(8px) |
| ToggleGroup | `toggle-group.tsx` | Outline/Default × Active Item | h-9(36px), rounded-md(6px) |
| ColorSwatch | custom | Default/Selected | 24×24 circle, selected ring |
| GradientSwatch | custom | Linear/Radial | 24×24 rect, gradient fill |

### Molecules (조합 컴포넌트)

| Component | Description | Variants |
|---|---|---|
| PropertyRow | Label + Control 쌍 (인스펙터의 기본 행) | NumericInput / Select / Switch / Badge |
| LayerTreeItem | 색상 도트 + 이름 + 가시성 아이콘 | Default / Selected / Hidden / Nested |
| VariantSizePill | 사이즈 변형 선택 필 | Default / Selected |
| StatePill | 색상 바 + 상태 이름 | Default / Hover / Active |
| TransitionRow | From → To + Strategy Badge | Morph / Trim / Crossfade |
| IconGridItem | 아이콘 썸네일 + 이름 | Default / Selected / Hover |
| ProjectCard | 아이콘 프리뷰 그리드 + 메타 정보 | Local / Registry |

### Organisms (패널급 컴포넌트)

| Component | Description | Key Specs |
|---|---|---|
| Toolbar | macOS 트래픽 라이트 + 탭 + 도구 세그먼트 + 액션 | 38px height, full width |
| LayerPanel | Variants + States + Layer Tree sections | 220px sidebar |
| InspectorPanel | Tabs(Inspect/Animate/Export) + Property Rows | 260px sidebar |
| TransitionPanel | 전환 목록 + Timeline Editor | Bottom panel, full width |
| Canvas | SVG 편집 영역 + Grid + Dock | Center area |
| ExplorerHeader | Logo + Search + Import + New Set | 52px header |
| ImportDialog (DialogShell) | 7-tab modal + form content | 520×420px |

---

## Property Editor Variation Matrix

Inspector 패널에서 필요한 프로퍼티 에디터 조합:

### Numeric Input Contexts (25개)

Canvas Size, Stroke Width, Opacity, X Position, Y Position, Rotation, Scale, Border Radius, Trim Start, Trim End, Trim Offset, Duration (ms), Delay (ms), Stagger (ms), Variable Value, Path Weight, Star Points, Polygon Sides, Dash Length, Dash Gap, Shadow X, Shadow Y, Shadow Blur, Shadow Spread, Font Size

### Select Contexts (9개)

Rendering Mode, Stroke Cap, Stroke Join, Fill Rule, Blend Mode, Transition Strategy, Easing Preset, Shape Sub-tool, Export Format

### Badge Contexts (7개)

Morph Strategy, Trim Strategy, Crossfade Strategy, Locked State, Derived Variant, Mask Mode, Compatibility Status

---

## User Flow Coverage (48 flows)

| # | Flow | Screen(s) | Entry Point |
|---|---|---|---|
| 1 | First launch (empty) | 1A (empty) | App start |
| 2 | Create icon set | 1A → dialog | "+ New Set" |
| 3 | Browse icon sets | 1A | Default |
| 4 | Enter icon set | 1A → 1B | Click card |
| 5 | Search icons | 1B | Search bar |
| 6 | Filter by category | 1B | Sidebar |
| 7 | Filter by collection | 1B | Sidebar |
| 8 | Filter by favorites | 1B | Sidebar |
| 9 | Bulk select & categorize | 1B | Multi-select |
| 10 | Bulk export | 1B | Multi-select |
| 11 | Bulk delete | 1B → 10A | Multi-select |
| 12 | Import SVG (raw) | 3 (SVG) | Import menu |
| 13 | Import from Figma | 3 (Figma) | Import menu |
| 14 | Import from library | 3 (library) | Import menu |
| 15 | Import from plugin | 3 (Plugin) | Import menu |
| 16 | Create blank icon | 2A | Toolbar / Explorer |
| 17 | Open project file | 1A / 2A | Toolbar |
| 18 | Save project | 2A | Toolbar / ⌘S |
| 19 | Edit icon path (pen) | 2D | Tool dock |
| 20 | Draw shape | 2D | Tool dock |
| 21 | Select & move layers | 2D | Tool dock |
| 22 | Edit layer styles | 2F | Right sidebar |
| 23 | Change fill/stroke | 2F → 7 | Inspect tab |
| 24 | Set layer role | 2F | Inspect tab |
| 25 | View topology | 2F | Inspect tab |
| 26 | Add variant size | 2C | Left sidebar |
| 27 | Generate derived variant | 2C | Left sidebar |
| 28 | Add state | 2C | Left sidebar |
| 29 | Rename state | 2E / 2F | Inspect tab |
| 30 | Delete state | 2F → 10C | Inspect tab |
| 31 | Create transition | 2G → 5 | Animation tab |
| 32 | Edit transition bindings | 2G | Animation tab |
| 33 | Edit track properties | 2G | Animation tab |
| 34 | Preview transition | 2G | Animation tab |
| 35 | Edit easing curve | 6 | Transition form |
| 36 | Pick color | 7 | Fill/stroke editor |
| 37 | Export SVG | 4 | Export menu |
| 38 | Export Lottie | 4 | Export menu |
| 39 | Export React library | 4 | Export menu |
| 40 | Sync to local dir | 9A | Sync panel |
| 41 | Create GitHub PR | 9B | Sync panel |
| 42 | Publish to npm | 9C | Sync panel |
| 43 | View keyboard shortcuts | 8 | Help menu |
| 44 | Switch between icons | 2A | Title tab bar |
| 45 | Undo / redo | 2A | Toolbar / ⌘Z |
| 46 | Zoom / pan canvas | 2D | Dock / scroll |
| 47 | Delete icon set | 1A → 10A | Context menu |
| 48 | Unsaved changes prompt | 10B | Close tab/window |

---

## Figma Design File Reference

**File:** [IconStudio-Screens](https://www.figma.com/design/pjZU0O5hL442UwdGYP3184/IconStudio-Screens)

| Page | Contents |
|---|---|
| Screens | 10개 화면 와이어프레임 (1A~10C) |
| Component Library | Atoms(11) + Molecules(7) + Organisms(7) = 25 component sets |
| Design Tokens | Colors(12) + Typography(5) + Radius(6) + Shadows(3) + Layout dims |

---

## Design Tokens Summary

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#3186EE` | Primary buttons, active states, selection rings |
| `--destructive` | `#F1265A` | Delete buttons, error states |
| `--foreground` | `#090D10` | Body text, headings |
| `--muted-foreground` | `#647484` | Secondary text, labels, placeholders |
| `--secondary` | `#F3F7FA` | Badge backgrounds, secondary buttons |
| `--muted` | `#F3F4F6` | Tab list bg, accent bg |
| `--border` | `rgba(0,0,0,0.05)` | Panel borders, dividers |
| `--input` | `rgba(0,0,0,0.10)` | Input borders, form controls |
| `--toolbar-h` | `38px` | Toolbar height |
| `--sidebar-w` | `220px` (wire) | Left sidebar width |
| `--inspector-w` | `260px` (wire) | Right sidebar width |
| `--text-xs` | `9px` | Labels, section headers |
| `--text-sm` | `11px` | Property labels, compact UI |
| `--text-base` | `13px` | Body text |
| `--text-lg` | `15px` | Section titles |
| `rounded-md` | `6px` | Buttons, inputs, selects |
| `rounded-lg` | `8px` | Tab lists, cards |
| `--radius` | `14px` | Dialogs, project cards |
