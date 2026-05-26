import AppKit
import ApplicationServices
import Foundation

struct ActiveAppContext: Equatable {
    var appName: String
    var windowTitle: String
    var selectedText: String
    var clipboardText: String
    var needsAccessibilityPermission: Bool

    func draft() -> CaptureDraft {
        let text = selectedText.trimmed.isEmpty ? clipboardText : selectedText
        let source = text.looksLikeURL ? text : ""
        return CaptureDraft(
            appName: appName,
            windowTitle: windowTitle,
            source: source,
            selectedText: source.isEmpty ? text : "",
            thought: "",
            projectId: nil,
            needsAccessibilityPermission: needsAccessibilityPermission
        )
    }
}

struct ActiveContextService {
    func read() -> ActiveAppContext {
        let app = NSWorkspace.shared.frontmostApplication
        let appName = app?.localizedName ?? ""
        let canUseAccessibility = accessibilityTrustedOrPrompt()
        let windowTitle = canUseAccessibility ? focusedWindowTitle(processIdentifier: app?.processIdentifier) : ""
        let selectedText = canUseAccessibility ? selectedText(processIdentifier: app?.processIdentifier) : ""
        let clipboardText = NSPasteboard.general.string(forType: .string) ?? ""
        return ActiveAppContext(
            appName: appName,
            windowTitle: windowTitle,
            selectedText: selectedText,
            clipboardText: clipboardText,
            needsAccessibilityPermission: !canUseAccessibility
        )
    }

    private func accessibilityTrustedOrPrompt() -> Bool {
        if AXIsProcessTrusted() { return true }
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    private func focusedWindowTitle(processIdentifier: pid_t?) -> String {
        guard let processIdentifier else { return "" }
        let appElement = AXUIElementCreateApplication(processIdentifier)
        var focusedWindow: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
        guard result == .success, let focusedWindow else { return "" }
        var title: CFTypeRef?
        AXUIElementCopyAttributeValue(focusedWindow as! AXUIElement, kAXTitleAttribute as CFString, &title)
        return title as? String ?? ""
    }

    private func selectedText(processIdentifier: pid_t?) -> String {
        guard let processIdentifier else { return "" }
        let appElement = AXUIElementCreateApplication(processIdentifier)
        var focusedElement: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)
        guard focusResult == .success, let focusedElement else { return "" }
        var selectedText: CFTypeRef?
        AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedText)
        return selectedText as? String ?? ""
    }
}

private extension String {
    var looksLikeURL: Bool {
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }
}
