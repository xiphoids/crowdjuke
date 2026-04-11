import UIKit
import Social
import UniformTypeIdentifiers

/// iOS Share Extension that receives URLs shared from music apps (Spotify,
/// YouTube, Apple Music) and opens the main CrowdJuke app with the link
/// attached as a query parameter.
///
/// The last-used event code is stored in an App Group (`UserDefaults`) by the
/// main app's WebView via a Capacitor plugin or JS bridge. If no code is
/// stored, the extension shows a text field so the user can enter one.
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.crowdjuke.app"
    private let eventCodeKey = "lastEventCode"

    private var codeField: UITextField?
    private var sharedUrl: String?
    private var containerView: UIView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        buildUI()
        extractUrl()
    }

    // MARK: - UI

    private func buildUI() {
        containerView = UIView()
        containerView.backgroundColor = UIColor.systemBackground
        containerView.layer.cornerRadius = 16
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 300),
        ])

        let title = UILabel()
        title.text = "Add to CrowdJuke"
        title.font = .boldSystemFont(ofSize: 17)
        title.textAlignment = .center

        let field = UITextField()
        field.placeholder = "Event code"
        field.borderStyle = .roundedRect
        field.autocapitalizationType = .allCharacters
        field.textAlignment = .center
        if let stored = storedCode() {
            field.text = stored
        }
        codeField = field

        let sendButton = UIButton(type: .system)
        sendButton.setTitle("Send to Event", for: .normal)
        sendButton.titleLabel?.font = .boldSystemFont(ofSize: 16)
        sendButton.addTarget(self, action: #selector(didTapSend), for: .touchUpInside)

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.addTarget(self, action: #selector(didTapCancel), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, field, sendButton, cancelButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -20),
        ])
    }

    // MARK: - Extract shared URL

    private func extractUrl() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return }
        for item in items {
            for attachment in item.attachments ?? [] {
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] data, _ in
                        if let url = data as? URL {
                            self?.sharedUrl = url.absoluteString
                        }
                    }
                    return
                }
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] data, _ in
                        if let text = data as? String {
                            self?.sharedUrl = self?.firstUrl(in: text)
                        }
                    }
                    return
                }
            }
        }
    }

    private func firstUrl(in text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let match = detector?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text))
        return match?.url?.absoluteString
    }

    // MARK: - App Group storage

    private func storedCode() -> String? {
        UserDefaults(suiteName: appGroupId)?.string(forKey: eventCodeKey)
    }

    private func saveCode(_ code: String) {
        UserDefaults(suiteName: appGroupId)?.set(code, forKey: eventCodeKey)
    }

    // MARK: - Actions

    @objc private func didTapSend() {
        let code = (codeField?.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !code.isEmpty else { return }
        guard let urlString = sharedUrl, !urlString.isEmpty else {
            dismiss()
            return
        }

        saveCode(code)

        let encoded = urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlString
        if let openUrl = URL(string: "crowdjuke://event/\(code)?share=\(encoded)") {
            // Open the main app via custom URL scheme. On iOS 18+ the
            // recommended approach is UIApplication.shared.open, but extensions
            // can't call that directly — use the responder chain trick.
            openURL(openUrl)
        }

        dismiss()
    }

    @objc private func didTapCancel() {
        dismiss()
    }

    private func dismiss() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Opens a URL from an extension by walking the responder chain.
    @objc private func openURL(_ url: URL) {
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication {
                app.open(url)
                return
            }
            responder = r.next
        }
    }
}
