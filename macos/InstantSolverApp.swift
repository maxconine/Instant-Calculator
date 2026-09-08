import AppKit
import Carbon
import SwiftUI

@main
struct InstantSolverApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        MenuBarExtra("Instant Solver", systemImage: "sum") {
            Button("Quick Calc") { appDelegate.toggleOverlay() }
            Divider()
            Button("Quit Instant Solver") { NSApp.terminate(nil) }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var overlay: OverlayController?
    private var hotKeyRef: EventHotKeyRef?

    func applicationDidFinishLaunching(_ notification: Notification) {
        overlay = OverlayController()
        overlay?.preload()
        registerHotKey()
        NSApp.setActivationPolicy(.accessory)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        overlay?.toggle()
        return true
    }

    func toggleOverlay() {
        overlay?.toggle()
    }

    private func registerHotKey() {
        HotKeyBox.shared.onPress = { [weak self] in
            DispatchQueue.main.async { self?.toggleOverlay() }
        }
        let hotKeyID = EventHotKeyID(signature: OSType(0x49534C56), id: 1)
        let modifiers = UInt32(controlKey | optionKey)
        let status = RegisterEventHotKey(
            UInt32(kVK_Space),
            modifiers,
            hotKeyID,
            GetEventDispatcherTarget(),
            0,
            &hotKeyRef
        )
        if status != noErr {
            NSLog("Instant Solver: failed to register Control+Option+Space (%d)", status)
        }

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(
            GetEventDispatcherTarget(),
            instantSolverHotKeyHandler,
            1,
            &eventType,
            nil,
            nil
        )
    }
}

final class HotKeyBox {
    static let shared = HotKeyBox()
    var onPress: (() -> Void)?
}

func instantSolverHotKeyHandler(
    _ nextHandler: EventHandlerCallRef?,
    _ event: EventRef?,
    _ userData: UnsafeMutableRawPointer?
) -> OSStatus {
    var id = EventHotKeyID()
    GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &id
    )
    if id.signature == OSType(0x49534C56) {
        HotKeyBox.shared.onPress?()
    }
    return noErr
}
