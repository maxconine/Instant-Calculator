import AppKit
import Carbon
import SwiftUI
import WebKit

extension Notification.Name {
    static let focusOverlay = Notification.Name("InstantSolver.focusOverlay")
}

final class OverlayPanel: NSPanel {
    var onEscape: (() -> Void)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func cancelOperation(_ sender: Any?) {
        onEscape?()
    }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == UInt16(kVK_Escape) {
            onEscape?()
            return
        }
        super.keyDown(with: event)
    }
}

final class OverlayController: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    private var panel: OverlayPanel?
    private var web: WKWebView?
    private var fallback: NSView?
    private var escapeMonitor: Any?
    private var dragMonitor: Any?
    private var webReady = false
    private var triedBundle = false
    private var triedDevServer = false
    private let overlayWidth: CGFloat = 680
    private let overlayMinHeight: CGFloat = 58

    deinit {
        if let escapeMonitor {
            NSEvent.removeMonitor(escapeMonitor)
        }
        if let dragMonitor {
            NSEvent.removeMonitor(dragMonitor)
        }
    }

    func preload() {
        if panel == nil { build() }
    }

    func toggle() {
        if panel?.isVisible == true {
            hide()
            return
        }
        show()
    }

    func hide() {
        panel?.orderOut(nil)
        NSApp.setActivationPolicy(.accessory)
    }

    func show() {
        if panel == nil { build() }
        if panel?.contentView === fallback, let web, webReady {
            panel?.contentView = web
        }
        applySize(height: overlayMinHeight)
        position()
        NSApp.setActivationPolicy(.regular)
        NSApp.unhide(nil)
        NSApp.activate(ignoringOtherApps: true)
        panel?.makeKeyAndOrderFront(nil)
        panel?.makeFirstResponder(web)
        resetAndFocus()
        DispatchQueue.main.async { [weak self] in self?.resetAndFocus() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in self?.focusMath() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.focusMath() }
        NotificationCenter.default.post(name: .focusOverlay, object: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "instant" else { return }
        if let body = message.body as? String {
            handleMessage(body)
            return
        }
        if let dict = message.body as? [String: Any] {
            if let type = dict["type"] as? String, type == "size", let height = dict["height"] as? Double {
                applySize(height: CGFloat(height))
            }
            if let type = dict["type"] as? String, type == "dismiss" {
                hide()
            }
            if let type = dict["type"] as? String, type == "copy", let text = dict["text"] as? String {
                copyToPasteboard(text)
            }
            if let type = dict["type"] as? String, type == "drag" {
                beginWindowDrag()
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webReady = true
        focusMath()
        for delay in [0.05, 0.12, 0.3] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.focusMath()
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        recover(from: webView)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        recover(from: webView)
    }

    private func build() {
        let panel = OverlayPanel(
            contentRect: NSRect(x: 0, y: 0, width: overlayWidth, height: overlayMinHeight),
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.onEscape = { [weak self] in self?.hide() }
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.becomesKeyOnlyIfNeeded = false
        installEscapeMonitor()
        installDragMonitor()

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "instant")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        let boot = WKUserScript(
            source: """
            window.__INSTANT_QUICK = true;
            window.__INSTANT_KEYS = [];
            document.documentElement.classList.add('quick-native');
            window.addEventListener('keydown', function (e) {
              if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                try { window.webkit.messageHandlers.instant.postMessage('dismiss'); } catch (err) {}
                return;
              }
              var field = document.querySelector('.quick-plain');
              if (field && document.activeElement !== field && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
                window.__INSTANT_KEYS.push(e.key);
              }
            }, true);
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(boot)
        let web = WKWebView(frame: NSRect(x: 0, y: 0, width: overlayWidth, height: overlayMinHeight), configuration: config)
        web.navigationDelegate = self
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            web.underPageBackgroundColor = .clear
        }
        web.wantsLayer = true
        web.layer?.isOpaque = false
        web.layer?.backgroundColor = NSColor.clear.cgColor
        web.layer?.cornerRadius = 12
        web.layer?.masksToBounds = true
        if #available(macOS 13.3, *) { web.isInspectable = true }
        panel.contentView = web
        self.web = web
        self.panel = panel
        loadQuickCalc(web)
    }

    private func loadQuickCalc(_ web: WKWebView) {
        if let bundled = bundledQuickURL() {
            triedBundle = true
            web.loadFileURL(bundled, allowingReadAccessTo: bundled.deletingLastPathComponent())
            return
        }
        loadDevServer(web)
    }

    private func loadDevServer(_ web: WKWebView) {
        triedDevServer = true
        let url = URL(string: "http://127.0.0.1:5173/quick.html")!
        web.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 2))
    }

    private func recover(from webView: WKWebView) {
        if !triedBundle, let bundled = bundledQuickURL() {
            triedBundle = true
            webView.loadFileURL(bundled, allowingReadAccessTo: bundled.deletingLastPathComponent())
            return
        }
        if !triedDevServer {
            loadDevServer(webView)
            return
        }
        loadFallback(from: webView)
    }

    private func loadFallback(from webView: WKWebView) {
        if fallback == nil {
            let root = OverlayView(onDismiss: { [weak self] in self?.hide() })
            let host = NSHostingView(rootView: root)
            host.frame = panel?.contentView?.bounds ?? .zero
            host.autoresizingMask = [.width, .height]
            fallback = host
        }
        if let fallback, panel?.contentView !== fallback {
            panel?.contentView = fallback
            applySize(height: overlayMinHeight)
        }
        _ = webView
    }

    private func bundledQuickURL() -> URL? {
        guard let dir = Bundle.main.url(forResource: "web", withExtension: nil) else { return nil }
        let quick = dir.appendingPathComponent("quick.html")
        if FileManager.default.fileExists(atPath: quick.path) { return quick }
        let index = dir.appendingPathComponent("index.html")
        return FileManager.default.fileExists(atPath: index.path) ? index : nil
    }

    private func handleMessage(_ body: String) {
        if body == "dismiss" {
            hide()
            return
        }
        if body == "drag" {
            beginWindowDrag()
            return
        }
        if body.hasPrefix("copy:") {
            copyToPasteboard(String(body.dropFirst("copy:".count)))
            return
        }
        if body.hasPrefix("height:") {
            let raw = Double(body.dropFirst("height:".count)) ?? Double(overlayMinHeight)
            applySize(height: CGFloat(raw))
        }
    }

    private func copyToPasteboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func resetAndFocus() {
        guard let web else { return }
        panel?.makeFirstResponder(web)
        web.evaluateJavaScript("""
        (function () {
          if (window.__instantReset) window.__instantReset();
          var el = document.querySelector('.quick-plain') || document.querySelector('math-field');
          if (el) { el.focus(); if (window.__instantFocus) window.__instantFocus(); }
        })()
        """)
    }

    private func focusMath() {
        guard let web else { return }
        panel?.makeFirstResponder(web)
        web.evaluateJavaScript("""
        (function () {
          var el = document.querySelector('.quick-plain') || document.querySelector('math-field');
          if (el) { el.focus(); if (window.__instantFocus) window.__instantFocus(); }
        })()
        """)
    }

    private func applySize(height: CGFloat) {
        guard let panel else { return }
        let h = min(max(height.rounded(.up), overlayMinHeight), 420)
        var frame = panel.frame
        let oldH = frame.height
        frame.size = NSSize(width: overlayWidth, height: h)
        frame.origin.y += oldH - h
        panel.setFrame(frame, display: true)
    }

    private func beginWindowDrag() {
        guard let panel, let event = NSApp.currentEvent else { return }
        if event.type == .leftMouseDown || event.type == .leftMouseDragged {
            panel.performDrag(with: event)
        }
    }

    private func installEscapeMonitor() {
        guard escapeMonitor == nil else { return }
        escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, self.panel?.isVisible == true else { return event }
            if event.keyCode == UInt16(kVK_Escape) {
                self.hide()
                return nil
            }
            return event
        }
    }

    private func installDragMonitor() {
        guard dragMonitor == nil else { return }
        dragMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] event in
            guard let self, let panel = self.panel, panel.isVisible, event.window === panel else {
                return event
            }
            let p = event.locationInWindow
            let size = panel.frame.size
            let edge: CGFloat = 14
            let alongTop = p.y >= size.height - edge
            let topCorner = p.y >= size.height - 44 && (p.x <= edge || p.x >= size.width - edge)
            if alongTop || topCorner {
                panel.performDrag(with: event)
                return nil
            }
            return event
        }
    }

    private func position() {
        guard let panel, let screen = NSScreen.main?.visibleFrame else { return }
        let size = panel.frame.size
        let x = screen.midX - size.width / 2
        let y = screen.minY + screen.height * 0.72 - size.height
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }
}

struct OverlayView: View {
    var onDismiss: () -> Void
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            TextField("", text: $text, prompt: Text(""))
                .textFieldStyle(.plain)
                .font(.system(size: 22, weight: .regular, design: .default))
                .focused($focused)
                .onSubmit { submit() }
            Text(answer(for: text))
                .font(.system(size: 22, weight: .regular, design: .default).monospacedDigit())
                .foregroundStyle(Color(red: 0.11, green: 0.48, blue: 0.30))
                .lineLimit(1)
                .frame(minWidth: 72, alignment: .trailing)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, minHeight: 58, maxHeight: 58)
        .background(Color(nsColor: .windowBackgroundColor).opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onAppear { focused = true }
        .onReceive(NotificationCenter.default.publisher(for: .focusOverlay)) { _ in
            focused = true
        }
        .onExitCommand { onDismiss() }
    }

    private func answer(for text: String) -> String {
        guard let v = MathEval.evaluate(text) else { return "" }
        return MathEval.format(v)
    }

    private func submit() {
        if let v = MathEval.evaluate(text) {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(MathEval.format(v), forType: .string)
        }
        text = ""
    }
}
