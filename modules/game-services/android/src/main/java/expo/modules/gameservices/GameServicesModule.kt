package expo.modules.gameservices

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val RC_ACHIEVEMENT_UI = 9003
private const val RC_LEADERBOARD_UI = 9004

private class NoActivityException : CodedException("NO_ACTIVITY", "No current activity", null)

private class UiUnavailableException(cause: Throwable?) :
    CodedException("UI_UNAVAILABLE", cause?.message ?: "Games UI unavailable", cause)

/**
 * Thin bridge over Play Games Services v2. Sign-in is automatic (the SDK attempts
 * it at initialize); everything here is fire-and-forget-safe — the JS layer treats
 * any rejection as a soft no-op.
 */
class GameServicesModule : Module() {
    private val activity: Activity
        get() = appContext.currentActivity ?: throw NoActivityException()

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
            PlayGames.getGamesSignInClient(activity)
                .isAuthenticated
                .addOnSuccessListener { promise.resolve(it.isAuthenticated) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("signIn") { promise: Promise ->
            PlayGames.getGamesSignInClient(activity)
                .signIn()
                .addOnSuccessListener { promise.resolve(it.isAuthenticated) }
                .addOnFailureListener { promise.resolve(false) }
        }

        AsyncFunction("unlockAchievement") { id: String, promise: Promise ->
            // unlock() is queued client-side and idempotent; no result to await.
            PlayGames.getAchievementsClient(activity).unlock(id)
            promise.resolve(null)
        }

        AsyncFunction("submitScore") { leaderboardId: String, score: Double, promise: Promise ->
            PlayGames.getLeaderboardsClient(activity).submitScore(leaderboardId, score.toLong())
            promise.resolve(null)
        }

        AsyncFunction("showAchievements") { promise: Promise ->
            PlayGames.getAchievementsClient(activity)
                .achievementsIntent
                .addOnSuccessListener { intent ->
                    activity.startActivityForResult(intent, RC_ACHIEVEMENT_UI)
                    promise.resolve(null)
                }
                .addOnFailureListener { promise.reject(UiUnavailableException(it)) }
        }

        AsyncFunction("showLeaderboards") { promise: Promise ->
            PlayGames.getLeaderboardsClient(activity)
                .allLeaderboardsIntent
                .addOnSuccessListener { intent ->
                    activity.startActivityForResult(intent, RC_LEADERBOARD_UI)
                    promise.resolve(null)
                }
                .addOnFailureListener { promise.reject(UiUnavailableException(it)) }
        }

        AsyncFunction("showLeaderboard") { leaderboardId: String, promise: Promise ->
            PlayGames.getLeaderboardsClient(activity)
                .getLeaderboardIntent(leaderboardId)
                .addOnSuccessListener { intent ->
                    activity.startActivityForResult(intent, RC_LEADERBOARD_UI)
                    promise.resolve(null)
                }
                .addOnFailureListener { promise.reject(UiUnavailableException(it)) }
        }
    }
}
