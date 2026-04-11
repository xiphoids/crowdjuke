import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle crowdjuke:// URLs from the Share Extension.
        // Expected format: crowdjuke://event/<CODE>?share=<encodedURL>
        if url.scheme == "crowdjuke", let host = url.host {
            handleShareUrl(url, host: host)
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    /// Navigates the Capacitor WebView to the event page with the shared link.
    private func handleShareUrl(_ url: URL, host: String) {
        guard host == "event",
              let code = url.pathComponents.dropFirst().first,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let shareParam = components.queryItems?.first(where: { $0.name == "share" })?.value
        else { return }

        let encoded = shareParam.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? shareParam
        let webPath = "/event/\(code)?share=\(encoded)"

        // Navigate the Capacitor WebView
        DispatchQueue.main.async {
            guard let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge else { return }
            bridge.webView?.evaluateJavaScript("window.location.href = '\(webPath)'", completionHandler: nil)
        }
    }
}
