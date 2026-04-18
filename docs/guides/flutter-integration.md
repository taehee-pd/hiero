# Flutter Integration Guide

Use Cuneiform icons in Flutter apps with full animation and state support.

This guide assumes you are consuming generated Flutter output from the Cuneiform export pipeline.

## Install

```yaml
# pubspec.yaml
dependencies:
  cuneiform_icons: ^1.0.0
```

```bash
flutter pub get
```

## Basic Usage

```dart
import 'package:cuneiform_icons/cuneiform_icons.dart';

class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CuneiformIcon(
      name: 'home',
      size: 24,
    );
  }
}
```

Generated Flutter packages usually ship a widget API plus painter/runtime support files. Prefer the generated widget entrypoints instead of reconstructing icon data manually.

## States & Transitions

```dart
class InteractiveIcon extends StatefulWidget {
  @override
  _InteractiveIconState createState() => _InteractiveIconState();
}

class _InteractiveIconState extends State<InteractiveIcon> {
  String _state = 'default';

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() {
        _state = _state == 'default' ? 'active' : 'default';
      }),
      child: CuneiformIcon(
        name: 'home',
        state: _state,
        animate: true,
      ),
    );
  }
}
```

## Variants

```dart
CuneiformIcon(name: 'home', variant: '32px')
CuneiformIcon(name: 'home', variant: 'filled')
```

## Effects

```dart
CuneiformIcon(
  name: 'bell',
  effect: 'bounce',
  onEffectComplete: (effectId) => print('$effectId done'),
)
```

## Variable Value

```dart
CuneiformIcon(
  name: 'wifi',
  variableValue: 0.75, // 0.0 to 1.0
)
```

## Accessibility

```dart
Semantics(
  label: 'Home',
  child: CuneiformIcon(name: 'home'),
)
```

## Reduced Motion

Respects `MediaQuery.of(context).disableAnimations` by default.

```dart
CuneiformIcon(name: 'home', reduceMotion: false) // Force animations
```

## Controller API

```dart
final controller = CuneiformIconController();

CuneiformIcon(
  name: 'home',
  controller: controller,
)

// Programmatic control
controller.transitionTo('active');
controller.triggerEffect('bounce');
controller.cancelAllEffects();
```

## Package Integration Tips

- Publish the generated package internally if multiple Flutter apps share the same icon set.
- Keep generated icons versioned independently from app releases when possible.
- Treat breaking icon removals or renamed entrypoints as major package changes.

## Requirements

- Flutter 3.0+
- Dart 2.17+
