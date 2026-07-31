package expo.modules.gameservices

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val RC_ACHIEVEMENT_UI = 9003

/**
 * Thin bridge over Play Games Services v2. Sign-in is automatic (the SDK attempts
 * it at initialize), so `beginAuthentication` only reports what the SDK settled on.
 *
 * Reporting calls use the *Immediate* variants, whose Task actually resolves with
 * the outcome — the fire-and-forget `unlock`/`submitScore` cannot tell a caller
 * that the write was dropped, which would let the JS sync mark unsent state as
 * delivered. The Activity is captured once up front: re-reading it inside a
 * listener throws if the player has since backgrounded the game, and that throw
 * would escape outside the promise.
 */
class GameServicesModule : Module() {
    private val activityOrNull: Activity?
        get() = appContext.currentActivity

    override fun definition() = ModuleDefinition {
        Name("GameServices")

        OnCreate {
            // Guarded: with a missing/placeholder APP_ID the SDK logs and disables
            // itself; the guard keeps any eager IllegalStateException from crashing.
            try {
                appContext.reactContext?.applicationContext?.let { PlayGamesSdk.initialize(it) }
            } catch (_: Throwable) {
                // Games features stay dormant until the project id ships.
            }
        }

        AsyncFunction("isAuthenticated") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getGamesSignInClient(activity)
                .isAuthenticated
                .addOnSuccessListener { promise.resolve(it.isAuthenticated) }
                .addOnFailureListener { promise.resolve(false) }
        }

        // v2 signs in on its own at startup, so there is nothing extra to kick off.
        AsyncFunction("beginAuthentication") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getGamesSignInClient(activity)
                .isAuthenticated
                .addOnSuccessListener { promise.resolve(it.isAuthenticated) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("signIn") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getGamesSignInClient(activity)
                .signIn()
                .addOnSuccessListener { promise.resolve(it.isAuthenticated) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("unlockAchievement") { id: String, promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getAchievementsClient(activity)
                .unlockImmediate(id)
                .addOnSuccessListener { promise.resolve(true) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("submitScore") { leaderboardId: String, score: Double, promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getLeaderboardsClient(activity)
                .submitScoreImmediate(leaderboardId, score.toLong())
                .addOnSuccessListener { promise.resolve(true) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("showAchievements") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            PlayGames.getAchievementsClient(activity)
                .achievementsIntent
                .addOnSuccessListener { intent ->
                    // The player may have left while the intent was loading.
                    val live = activityOrNull
                    if (live == null) {
                        promise.resolve(false)
                    } else {
                        live.startActivityForResult(intent, RC_ACHIEVEMENT_UI)
                        promise.resolve(true)
                    }
                }
                .addOnFailureListener { promise.resolve(false) }
        }
    }
}
