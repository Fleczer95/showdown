import ExpoModulesCore
import GameKit

/// Dismisses the Game Center sheet when the player closes it.
private class GameCenterDismissDelegate: NSObject, GKGameCenterControllerDelegate {
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}

/// GameKit can stay silent forever if a sheet is dismissed in a way that never
/// produces a terminal callback, so every wait is bounded.
private let authTimeout: TimeInterval = 60

/**
 Thin bridge over GameKit.

 Assigning `authenticateHandler` is what initializes Game Center, and Apple warns
 that initialization may put UI on screen — so nothing here touches GameKit until
 the app actually needs it: either the player asked (`signIn`) or there is earned
 progress waiting to be mirrored (`beginAuthentication`). A fresh install with
 nothing to send never initializes Game Center at all.

 Everything is soft-fail: unauthenticated calls resolve without effect, and every
 reporting call answers with whether it truly landed, so the caller can retry.
 */
public class GameServicesModule: Module {
    private let dismissDelegate = GameCenterDismissDelegate()

    /// The sheet GameKit handed us, kept until the player shows intent.
    private var pendingAuthViewController: UIViewController?
    /// Callers waiting for authentication to settle. All resolve on one outcome.
    private var authWaiters: [Promise] = []
    /// True between assigning the handler and its terminal callback.
    private var authInFlight = false
    /// Identifies the current attempt. A callback or timeout left over from an
    /// earlier attempt would otherwise settle whichever attempt is running now —
    /// cancelling a sign-in the player just started.
    private var authGeneration = 0
    /// Set only for the duration of an explicit sign-in, so a sheet GameKit raises
    /// on its own initiative is never presented behind the player's back.
    private var mayPresentSignIn = false

    private var currentViewController: UIViewController? {
        appContext?.utilities?.currentViewController()
    }

    /// Starts (or joins) authentication. `presenting` is the caller's intent, not a
    /// property of the attempt — a silent attempt already in flight is upgraded when
    /// the player asks for the sheet.
    private func authenticate(presenting: Bool, promise: Promise) {
        if GKLocalPlayer.local.isAuthenticated {
            return promise.resolve(true)
        }

        authWaiters.append(promise)
        if presenting {
            mayPresentSignIn = true
            presentPendingSheet()
        }
        guard !authInFlight else { return }

        authInFlight = true
        authGeneration += 1
        let generation = authGeneration

        // Re-assigning restarts authentication, which is how a failed attempt
        // (offline at launch, say) becomes retryable without a process restart.
        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, _ in
            guard let self, generation == self.authGeneration else { return }
            if let sheet = viewController {
                self.pendingAuthViewController = sheet
                self.presentPendingSheet()
                return  // GameKit calls back again once the sheet is done.
            }
            self.settleAuth(GKLocalPlayer.local.isAuthenticated)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + authTimeout) { [weak self] in
            guard let self, self.authInFlight, generation == self.authGeneration else { return }
            self.settleAuth(GKLocalPlayer.local.isAuthenticated)
        }
    }

    /// Ends the current attempt: answer everyone waiting, then reset so the next
    /// caller starts a fresh one.
    private func settleAuth(_ authenticated: Bool) {
        authInFlight = false
        mayPresentSignIn = false
        pendingAuthViewController = nil
        let waiters = authWaiters
        authWaiters = []
        waiters.forEach { $0.resolve(authenticated) }
    }

    private func presentPendingSheet() {
        guard mayPresentSignIn, let sheet = pendingAuthViewController, let root = currentViewController else {
            return
        }
        pendingAuthViewController = nil
        root.present(sheet, animated: true)
    }

    /// Presents a Game Center dashboard, resolving false when it can't be shown.
    private func present(_ sheet: GKGameCenterViewController, _ promise: Promise) {
        guard GKLocalPlayer.local.isAuthenticated, let root = currentViewController else {
            return promise.resolve(false)
        }
        sheet.gameCenterDelegate = dismissDelegate
        root.present(sheet, animated: true) { promise.resolve(true) }
    }

    public func definition() -> ModuleDefinition {
        Name("GameServices")

        AsyncFunction("isAuthenticated") { () -> Bool in
            GKLocalPlayer.local.isAuthenticated
        }

        // Silent attempt: initializes Game Center without ever presenting a sheet.
        AsyncFunction("beginAuthentication") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return promise.resolve(false) }
                self.authenticate(presenting: false, promise: promise)
            }
        }

        AsyncFunction("signIn") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return promise.resolve(false) }
                self.authenticate(presenting: true, promise: promise)
            }
        }

        AsyncFunction("unlockAchievement") { (id: String, promise: Promise) in
            guard GKLocalPlayer.local.isAuthenticated else { return promise.resolve(false) }
            let achievement = GKAchievement(identifier: id)
            achievement.percentComplete = 100
            achievement.showsCompletionBanner = true
            GKAchievement.report([achievement]) { error in promise.resolve(error == nil) }
        }

        AsyncFunction("submitScore") { (leaderboardId: String, score: Double, promise: Promise) in
            guard GKLocalPlayer.local.isAuthenticated else { return promise.resolve(false) }
            GKLeaderboard.submitScore(
                Int(score),
                context: 0,
                player: GKLocalPlayer.local,
                leaderboardIDs: [leaderboardId]
            ) { error in promise.resolve(error == nil) }
        }

        // Game Stats is a Play Games Services feature with no Game Center analogue.
        AsyncFunction("recordStatsEvent") { (_: String, _: [String: Any], promise: Promise) in
            promise.resolve(false)
        }

        // Play Saved Games is Android-only. These stubs exist so the JS surface
        // needs no platform branches; iOS progression lives in local MMKV and is
        // mirrored to Game Center by the sync layer.
        AsyncFunction("readCloudSave") { (promise: Promise) in
            promise.resolve(nil)
        }

        AsyncFunction("writeCloudSave") { (_: String, promise: Promise) in
            promise.resolve(false)
        }

        AsyncFunction("showAchievements") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return promise.resolve(false) }
                self.present(GKGameCenterViewController(state: .achievements), promise)
            }
        }
    }
}
