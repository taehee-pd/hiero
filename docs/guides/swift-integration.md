# Swift Integration Guide

Integrate Coniva icons into iOS/macOS apps with SwiftUI or UIKit.

## Install (Swift Package Manager)

Add the package to your `Package.swift` or Xcode project:

```swift
dependencies: [
    .package(url: "https://github.com/your-org/coniva-icons-swift", from: "1.0.0")
]
```

## SwiftUI Usage

```swift
import ConivaIcons

struct ContentView: View {
    var body: some View {
        ConivaIcon("home", size: 24)
    }
}
```

## States & Transitions

```swift
struct InteractiveIcon: View {
    @State private var iconState = "default"

    var body: some View {
        ConivaIcon("home", state: iconState, animate: true)
            .onTapGesture {
                iconState = iconState == "default" ? "active" : "default"
            }
    }
}
```

## Variants

```swift
// By size
ConivaIcon("home", variant: 32)

// By name
ConivaIcon("home", variant: "filled")
```

## Effects

```swift
struct BouncingIcon: View {
    @State private var effect: String? = nil

    var body: some View {
        ConivaIcon("bell", effect: effect)
            .onTapGesture { effect = "bounce" }
    }
}
```

## Accessibility

```swift
ConivaIcon("home")
    .accessibilityLabel("Home")

ConivaIcon("decorative-divider")
    .accessibilityHidden(true)
```

## Reduced Motion

Respects `UIAccessibility.isReduceMotionEnabled` by default.

```swift
ConivaIcon("home", reduceMotion: false) // Force animations
```

## UIKit Adapter

```swift
import ConivaIcons

let iconView = ConivaIconView(name: "home", size: 24)
iconView.setState("active", animated: true)
iconView.triggerEffect("bounce")
view.addSubview(iconView)
```

## Requirements

- iOS 16+ / macOS 13+
- Swift 5.9+
- SwiftUI or UIKit
