import ExpoModulesCore
import GameKit

/// Dismisses the Game Center sheet when the player closes it.
private class GameCenterDismissDelegate: NSObject, GKGameCenterControllerDelegate {
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}

/**
 Thin bridge over GameKit. Authentication is attempted silently at startup; the
 sign-in sheet GameKit hands us is *held* (never presented on cold start — a
 deliberate UX decision) until the player shows intent via `signIn()`.
 Everything is soft-fail: unauthenticated calls resolve without effect.
 */
public class GameServicesModule: Module {
    private var pendingAuthViewController: UIViewController?
    private let dismissDelegate = GameCenterDismissDelegate()

    private var currentViewController: UIViewController? {
        appContext?.utilities?.currentViewController()
    }

    public func definition() -> ModuleDefinition {
        Name("GameServices")

        OnCreate {
            DispatchQueue.main.async { [weak self] in
                GKLocalPlayer.local.authenticateHandler = { viewController, _ in
                    // Silent auth when possible; otherwise keep the sheet for later.
                    self?.pendingAuthViewController = viewController
                }
            }
        }

        AsyncFunction("isAuthenticated") { () -> Bool in
            GKLocalPlayer.local.isAuthenticated
        }

        AsyncFunction("signIn") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return promise.resolve(false) }
                if GKLocalPlayer.local.isAuthenticated {
                    return promise.resolve(true)
                }
                if let sheet = self.pendingAuthViewController, let root = self.currentViewController {
                    self.pendingAuthViewController = nil
                    root.present(sheet, animated: true)
                }
                // The sheet completes asynchronously via authenticateHandler; report
                // the current state and let callers re-check on their next attempt.
                promise.resolve(GKLocalPlayer.local.isAuthenticated)
            }
        }

        AsyncFunction("unlockAchievement") { (id: String, promise: Promise) in
            guard GKLocalPlayer.local.isAuthenticated else { return promise.resolve() }
            let achievement = GKAchievement(identifier: id)
            achievement.percentComplete = 100
            achievement.showsCompletionBanner = true
            GKAchievement.report([achievement]) { _ in promise.resolve() }
        }

        AsyncFunction("submitScore") { (leaderboardId: String, score: Double, promise: Promise) in
            guard GKLocalPlayer.local.isAuthenticated else { return promise.resolve() }
            GKLeaderboard.submitScore(
                Int(score),
                context: 0,
                player: GKLocalPlayer.local,
                leaderboardIDs: [leaderboardId]
            ) { _ in promise.resolve() }
        }

        AsyncFunction("showAchievements") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self, GKLocalPlayer.local.isAuthenticated, let root = self.currentViewController else {
                    return promise.resolve()
                }
                let sheet = GKGameCenterViewController(state: .achievements)
                sheet.gameCenterDelegate = self.dismissDelegate
                root.present(sheet, animated: true) { promise.resolve() }
            }
        }

        AsyncFunction("showLeaderboard") { (leaderboardId: String, promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self, GKLocalPlayer.local.isAuthenticated, let root = self.currentViewController else {
                    return promise.resolve()
                }
                let sheet = GKGameCenterViewController(
                    leaderboardID: leaderboardId,
                    playerScope: .global,
                    timeScope: .allTime
                )
                sheet.gameCenterDelegate = self.dismissDelegate
                root.present(sheet, animated: true) { promise.resolve() }
            }
        }
    }
}
