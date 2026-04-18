# Swift Integration Guide

Integrate Cuneiform icons into iOS/macOS apps with SwiftUI or UIKit.

This guide assumes you are consuming a generated Swift package produced from the Cuneiform export pipeline.

## Install (Swift Package Manager)

Add the package to your `Package.swift` or Xcode project:

```swift
dependencies: [
    .package(url: "https://github.com/your-org/cuneiform-icons-swift", from: "1.0.0")
]
```

## SwiftUI Usage

```swift
import CuneiformIcons

struct ContentView: View {
    var body: some View {
        CuneiformIcon("home", size: 24)
    }
}
```

The generated package typically includes a strongly named icon API plus a shared renderer layer. Use the generated entrypoints whenever possible rather than reaching into compiled JSON manually.

## States & Transitions

```swift
struct InteractiveIcon: View {
    @State private var iconState = "default"

    var body: some View {
        CuneiformIcon("home", state: iconState, animate: true)
            .onTapGesture {
                iconState = iconState == "default" ? "active" : "default"
            }
    }
}
```

## Variants

```swift
// By size
CuneiformIcon("home", variant: 32)

// By name
CuneiformIcon("home", variant: "filled")
```

## Effects

```swift
struct BouncingIcon: View {
    @State private var effect: String? = nil

    var body: some View {
        CuneiformIcon("bell", effect: effect)
            .onTapGesture { effect = "bounce" }
    }
}
```

## Accessibility

```swift
CuneiformIcon("home")
    .accessibilityLabel("Home")

CuneiformIcon("decorative-divider")
    .accessibilityHidden(true)
```

## Reduced Motion

Respects `UIAccessibility.isReduceMotionEnabled` by default.

```swift
CuneiformIcon("home", reduceMotion: false) // Force animations
```

## UIKit Adapter

```swift
import CuneiformIcons

let iconView = CuneiformIconView(name: "home", size: 24)
iconView.setState("active", animated: true)
iconView.triggerEffect("bounce")
view.addSubview(iconView)
```

## Distribution Notes

- Keep the generated package in source control or publish it through your internal package registry.
- Match the minimum deployment target in the generated package with your app target.
- Re-export the icon module from your design-system package if you want app teams to consume one stable entrypoint.

## Requirements

- iOS 16+ / macOS 13+
- Swift 5.9+
- SwiftUI or UIKit
