import ExpoModulesCore
import GameKit

/// Dismisses the Game Center sheet when the player closes it.
private class GameCenterDismissDelegate: NSObject, GKGameCenterControllerDelegate {
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}

/**
 Thin bridge over GameKit. Authentication is opt-in: installing GameKit's
 authenticate handler is what makes iOS show the full-screen sign-in sheet, so a
 player who has never used Game Center never gets one until they ask for it via
 `signIn()`. Once someone has authenticated on this install we remember it and
 authenticate silently on every later launch, which keeps the background sync
 working without ever prompting again.
 Everything is soft-fail: unauthenticated calls resolve without effect.
 */
public class GameServicesModule: Module {
    /// Marks that the player authenticated at least once on this install — the
    /// signal that startup authentication is welcome rather than an ambush.
    private static let hasAuthenticatedKey = "GameServices.hasAuthenticated"

    private let dismissDelegate = GameCenterDismissDelegate()
    private var pendingAuthViewController: UIViewController?
    private var pendingSignIn: Promise?
    private var handlerInstalled = false
    /// Only true once the player has asked to sign in — gates presenting the sheet.
    private var mayPresentSignIn = false

    private var currentViewController: UIViewController? {
        appContext?.utilities?.currentViewController()
    }

    /// Installs GameKit's authenticate handler exactly once. GameKit calls it with
    /// a sheet when it needs the player, then again with nil once auth settles.
    private func installAuthHandler() {
        guard !handlerInstalled else { return }
        handlerInstalled = true
        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, _ in
            guard let self else { return }
            if let sheet = viewController {
                self.pendingAuthViewController = sheet
                if self.mayPresentSignIn {
                    self.presentPendingSheet()
                }
                return
            }
            self.pendingAuthViewController = nil
            let authenticated = GKLocalPlayer.local.isAuthenticated
            if authenticated {
                UserDefaults.standard.set(true, forKey: Self.hasAuthenticatedKey)
            }
            self.pendingSignIn?.resolve(authenticated)
            self.pendingSignIn = nil
        }
    }

    private func presentPendingSheet() {
        guard let sheet = pendingAuthViewController, let root = currentViewController else { return }
        pendingAuthViewController = nil
        root.present(sheet, animated: true)
    }

    public func definition() -> ModuleDefinition {
        Name("GameServices")

        OnCreate {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                // Re-authenticate returning players only. A first-time player must
                // not meet a sign-in sheet before they have even seen the game.
                guard UserDefaults.standard.bool(forKey: Self.hasAuthenticatedKey) else { return }
                self.installAuthHandler()
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
                self.mayPresentSignIn = true
                // First intent of this session: start authentication and let the
                // handler resolve us once GameKit has an answer.
                if !self.handlerInstalled {
                    self.pendingSignIn = promise
                    self.installAuthHandler()
                    return
                }
                // Handler already live but GameKit has no sheet to show — there is
                // nothing to wait on, so don't leave the caller hanging.
                guard self.pendingAuthViewController != nil else {
                    return promise.resolve(false)
                }
                self.pendingSignIn = promise
                self.presentPendingSheet()
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

        AsyncFunction("showLeaderboards") { (promise: Promise) in
            DispatchQueue.main.async { [weak self] in
                guard let self, GKLocalPlayer.local.isAuthenticated, let root = self.currentViewController else {
                    return promise.resolve()
                }
                let sheet = GKGameCenterViewController(state: .leaderboards)
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
