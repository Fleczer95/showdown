package expo.modules.gameservices

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val RC_ACHIEVEMENT_UI = 9003

/** Single cloud-save slot. Versioned so a future format change can migrate cleanly. */
private const val SNAPSHOT_NAME = "showdown-progression-v1"

/** Platform hard limit on snapshot data. Guarded, never assumed. */
private const val MAX_SNAPSHOT_BYTES = 3 * 1024 * 1024

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

        // Cloud save. The payload is opaque here — merging is JS's job (see
        // src/game/progression/merge.ts), so this stays a dumb transport.
        // MOST_RECENTLY_MODIFIED is lossy on its own, but safe here: JS always
        // merges what it reads into local state and writes the union straight back,
        // so the losing side's progress is recovered on the next read.
        AsyncFunction("readCloudSave") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(null)
            PlayGames.getSnapshotsClient(activity)
                .open(SNAPSHOT_NAME, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnSuccessListener { result ->
                    val snapshot = result.data
                    if (snapshot == null) {
                        promise.resolve(null)
                    } else {
                        val bytes = snapshot.snapshotContents.readFully()
                        promise.resolve(if (bytes.isEmpty()) null else String(bytes, Charsets.UTF_8))
                    }
                }
                .addOnFailureListener { promise.resolve(null) }
        }

        AsyncFunction("writeCloudSave") { payload: String, promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            val bytes = payload.toByteArray(Charsets.UTF_8)
            // A silent truncation would corrupt a player's save, so refuse instead.
            if (bytes.size > MAX_SNAPSHOT_BYTES) return@AsyncFunction promise.resolve(false)
            val client = PlayGames.getSnapshotsClient(activity)
            client
                .open(SNAPSHOT_NAME, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnSuccessListener { result ->
                    val snapshot = result.data
                    if (snapshot == null) {
                        promise.resolve(false)
                    } else {
                        snapshot.snapshotContents.writeBytes(bytes)
                        client
                            .commitAndClose(snapshot, SnapshotMetadataChange.Builder().build())
                            .addOnSuccessListener { promise.resolve(true) }
                            .addOnFailureListener { promise.resolve(false) }
                    }
                }
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
