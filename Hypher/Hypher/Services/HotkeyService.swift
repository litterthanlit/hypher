import Carbon
import Foundation

final class HotkeyService {
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private var onPressed: (() -> Void)?

    deinit {
        unregister()
    }

    func register(onPressed: @escaping () -> Void) {
        self.onPressed = onPressed
        unregister()

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, _, userData in
                guard let userData else { return noErr }
                let service = Unmanaged<HotkeyService>.fromOpaque(userData).takeUnretainedValue()
                service.onPressed?()
                return noErr
            },
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &eventHandler
        )

        let hotKeyID = EventHotKeyID(signature: OSType(0x48595048), id: 1)
        RegisterEventHotKey(
            UInt32(kVK_ANSI_H),
            UInt32(cmdKey | shiftKey),
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
            self.eventHandler = nil
        }
    }
}
