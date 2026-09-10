import AppKit
import Carbon
import Combine

extension Notification.Name {
    static let instantSettingsChanged = Notification.Name("InstantSolver.settingsChanged")
}

final class AppSettings: ObservableObject {
    static let shared = AppSettings()
    static let sigFigsKey = "instant.sigFigs"
    static let draftSecondsKey = "instant.draftSeconds"
    static let defaultUnitsKey = "instant.defaultUnits"
    static let defaultSigFigs = 12
    static let minSigFigs = 2
    static let maxSigFigs = 16
    static let defaultDraftSeconds = 60
    static let minDraftSeconds = 0
    static let maxDraftSeconds = 3600

    @Published private(set) var significantFigures: Int
    @Published private(set) var draftSeconds: Int
    @Published private(set) var defaultUnits: [String: String]

    private init() {
        let storedFigs = UserDefaults.standard.integer(forKey: Self.sigFigsKey)
        significantFigures = Self.clampSigFigs(storedFigs == 0 ? Self.defaultSigFigs : storedFigs)
        if UserDefaults.standard.object(forKey: Self.draftSecondsKey) == nil {
            draftSeconds = Self.defaultDraftSeconds
        } else {
            draftSeconds = Self.clampDraftSeconds(UserDefaults.standard.integer(forKey: Self.draftSecondsKey))
        }
        defaultUnits = Self.loadDefaultUnits()
    }

    private static func loadDefaultUnits() -> [String: String] {
        guard let stored = UserDefaults.standard.dictionary(forKey: defaultUnitsKey) else { return [:] }
        var units: [String: String] = [:]
        for (dim, value) in stored {
            guard let id = value as? String, !id.isEmpty else { continue }
            units[dim] = id
        }
        return units
    }

    static func clampSigFigs(_ n: Int) -> Int {
        min(maxSigFigs, max(minSigFigs, n))
    }

    static func clampDraftSeconds(_ n: Int) -> Int {
        min(maxDraftSeconds, max(minDraftSeconds, n))
    }

    func setSignificantFigures(_ n: Int, notifyWeb: Bool) {
        let value = Self.clampSigFigs(n)
        guard value != significantFigures else { return }
        significantFigures = value
        UserDefaults.standard.set(value, forKey: Self.sigFigsKey)
        if notifyWeb {
            NotificationCenter.default.post(name: .instantSettingsChanged, object: nil)
        }
    }

    func setDraftSeconds(_ n: Int, notifyWeb: Bool) {
        let value = Self.clampDraftSeconds(n)
        guard value != draftSeconds else { return }
        draftSeconds = value
        UserDefaults.standard.set(value, forKey: Self.draftSecondsKey)
        if notifyWeb {
            NotificationCenter.default.post(name: .instantSettingsChanged, object: nil)
        }
    }

    func setDefaultUnit(dim: String, unitId: String, notifyWeb: Bool) {
        var next = defaultUnits
        let id = unitId.trimmingCharacters(in: .whitespacesAndNewlines)
        if id.isEmpty {
            next.removeValue(forKey: dim)
        } else {
            next[dim] = id
        }
        applyDefaultUnits(next, notifyWeb: notifyWeb)
    }

    func resetDefaultUnits(notifyWeb: Bool) {
        applyDefaultUnits([:], notifyWeb: notifyWeb)
    }

    private func applyDefaultUnits(_ next: [String: String], notifyWeb: Bool) {
        guard next != defaultUnits else { return }
        defaultUnits = next
        UserDefaults.standard.set(next, forKey: Self.defaultUnitsKey)
        if notifyWeb {
            NotificationCenter.default.post(name: .instantSettingsChanged, object: nil)
        }
    }

    func defaultUnitsJSON() -> String {
        let data = (try? JSONSerialization.data(withJSONObject: defaultUnits, options: [])) ?? Data("{}".utf8)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}

@main
enum InstantSolver {
    static let delegate = AppDelegate()

    static func main() {
        let app = NSApplication.shared
        app.delegate = delegate
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var overlay: OverlayController?
    private var hotKeyRef: EventHotKeyRef?
    private var statusItem: NSStatusItem?
    private var unitSettings: UnitSettingsWindowController?

    func applicationWillFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.prohibited)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        setupStatusItem()
        overlay = OverlayController()
        overlay?.preload()
        registerHotKey()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        overlay?.toggle()
        return false
    }

    func toggleOverlay() {
        overlay?.toggle()
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        buildStatusMenu(menu)
    }

    private func setupStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "sum", accessibilityDescription: "Instant Solver")
            button.image?.isTemplate = true
            button.toolTip = "Instant Solver"
        }
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
        statusItem = item
    }

    private func buildStatusMenu(_ menu: NSMenu) {
        let quick = NSMenuItem(title: "Show Instant Solver", action: #selector(showQuickCalc), keyEquivalent: "")
        quick.target = self
        menu.addItem(quick)
        menu.addItem(.separator())

        let figs = NSMenuItem(title: "Significant figures", action: nil, keyEquivalent: "")
        figs.submenu = sigFigsMenu()
        menu.addItem(figs)

        let draft = NSMenuItem(title: "Keep unfinished", action: nil, keyEquivalent: "")
        draft.submenu = draftMenu()
        menu.addItem(draft)

        let units = NSMenuItem(title: "Default units…", action: #selector(showUnitSettings), keyEquivalent: "")
        units.target = self
        menu.addItem(units)

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Instant Solver", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
    }

    private func sigFigsMenu() -> NSMenu {
        let menu = NSMenu()
        let current = AppSettings.shared.significantFigures
        for n in AppSettings.minSigFigs...AppSettings.maxSigFigs {
            let item = NSMenuItem(title: "\(n)", action: #selector(setSigFigs(_:)), keyEquivalent: "")
            item.target = self
            item.tag = n
            item.state = n == current ? .on : .off
            menu.addItem(item)
        }
        return menu
    }

    private func draftMenu() -> NSMenu {
        let menu = NSMenu()
        let current = AppSettings.shared.draftSeconds
        let options: [(String, Int)] = [
            ("Don't keep", 0),
            ("30 seconds", 30),
            ("1 minute", 60),
            ("2 minutes", 120),
            ("5 minutes", 300),
        ]
        for (title, seconds) in options {
            let item = NSMenuItem(title: title, action: #selector(setDraftSeconds(_:)), keyEquivalent: "")
            item.target = self
            item.tag = seconds
            item.state = seconds == current ? .on : .off
            menu.addItem(item)
        }
        return menu
    }

    @objc private func showQuickCalc() {
        overlay?.toggle()
    }

    @objc private func setSigFigs(_ sender: NSMenuItem) {
        AppSettings.shared.setSignificantFigures(sender.tag, notifyWeb: true)
    }

    @objc private func setDraftSeconds(_ sender: NSMenuItem) {
        AppSettings.shared.setDraftSeconds(sender.tag, notifyWeb: true)
    }

    @objc private func showUnitSettings() {
        if unitSettings == nil {
            unitSettings = UnitSettingsWindowController()
        }
        unitSettings?.show()
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
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
