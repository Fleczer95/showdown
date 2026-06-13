export type GameId =
    // ShowDown TV quiz modes
    | 'the_ladder' // 15-question trivia curve with lifelines (Millionaire-style)
    | 'the_grid' // category board, bet points on clues (Jeopardy-style)
    | 'the_opinion_poll' // guess weighted answers from a simulated survey (Family Feud-style)
    | 'the_wheel'; // solve word puzzles with a spinning multiplier (Wheel of Fortune-style)

export type PurchaseErrorCategory =
    | 'user_cancelled'
    | 'network'
    | 'store_unavailable'
    | 'already_owned'
    | 'payment_invalid'
    | 'unknown';

export type SelectionSource = 'setup_dropdown' | 'store_link';
export type StoreSource = 'gate_locked_category' | 'settings' | 'home' | 'direct';
export type RestoreSource = 'store' | 'settings';
export type GateType = 'locked_category' | 'locked_theme';
export type CardAction = 'correct' | 'skip' | 'pass';
export type RoundEndReason = 'timeout' | 'target_reached' | 'manual';
export type ExitPoint = 'back_button' | 'home_button' | 'app_background_timeout';
export type DocType = 'privacy_policy' | 'terms_of_use';

/** Lifelines available in The Ladder. */
export type Lifeline = 'fifty_fifty' | 'ask_the_studio' | 'skip_question';

export interface GameSessionParams {
    game_session_id: string;
    game_id: GameId;
}

export interface AppLifecycleParams extends GameSessionParams {
    round_number: number;
    time_remaining_ms: number;
}

export type AnalyticsEvent =
    | { name: 'game_setup_opened'; params: { game_id: GameId } }
    | {
          name: 'category_selected';
          params: { game_id: GameId; category_id: string; is_premium: boolean; selection_source: SelectionSource };
      }
    | {
          name: 'game_started';
          params: GameSessionParams & {
              category_id: string;
              is_premium_category: boolean;
              num_players: number;
              num_teams: number;
              target_score: number;
              round_seconds: number;
              setup_duration_ms: number;
              extras?: Record<string, string | number | boolean>;
          };
      }
    | { name: 'round_started'; params: GameSessionParams & { round_number: number; team_index: number } }
    | {
          name: 'card_action';
          params: GameSessionParams & {
              action: CardAction;
              round_number: number;
              time_remaining_ms: number;
              time_since_round_start_ms: number;
          };
      }
    | {
          name: 'round_ended';
          params: GameSessionParams & {
              round_number: number;
              team_index: number;
              correct_count: number;
              skip_count: number;
              round_duration_ms: number;
              time_to_first_action_ms: number;
              end_reason: RoundEndReason;
          };
      }
    | {
          name: 'game_completed';
          params: GameSessionParams & {
              duration_seconds: number;
              rounds_played: number;
              winner_team_index: number;
              final_score_a: number;
              final_score_b: number;
          };
      }
    | {
          name: 'game_abandoned';
          params: GameSessionParams & { exit_point: ExitPoint; rounds_played: number; duration_seconds: number };
      }
    | { name: 'app_backgrounded'; params: AppLifecycleParams }
    | { name: 'app_foregrounded'; params: AppLifecycleParams & { seconds_in_background: number } }
    | {
          name: 'play_again_clicked';
          params: { game_id: GameId; last_session_id: string; same_category: boolean; same_settings: boolean };
      }
    | { name: 'category_replayed'; params: { game_id: GameId; category_id: string; repeats_in_session: number } }
    // --- ShowDown mode-specific events ---
    | {
          name: 'ladder_lifeline_used';
          params: { game_session_id: string; question_number: number; lifeline: Lifeline };
      }
    | {
          name: 'ladder_question_answered';
          params: { game_session_id: string; question_number: number; is_correct: boolean; time_remaining_ms: number };
      }
    | {
          name: 'grid_wager_placed';
          params: { game_session_id: string; category_id: string; wager_amount: number; points_available: number };
      }
    | {
          name: 'grid_clue_resolved';
          params: { game_session_id: string; category_id: string; points: number; is_correct: boolean };
      }
    | {
          name: 'poll_guess_submitted';
          params: { game_session_id: string; question_id: string; rank_guessed: number; is_correct: boolean };
      }
    | { name: 'wheel_spun'; params: { game_session_id: string; multiplier: number; segment_label: string } }
    | {
          name: 'wheel_letter_guessed';
          params: { game_session_id: string; letter: string; is_present: boolean; occurrences: number };
      }
    // --- Store events ---
    | { name: 'store_viewed'; params: { source: StoreSource; game_id?: GameId } }
    | { name: 'pack_viewed'; params: { pack_id: string; game_id: GameId; is_purchased: boolean } }
    | { name: 'pack_purchase_started'; params: { pack_id: string; game_id: GameId; price_string: string } }
    | {
          name: 'pack_purchase_completed';
          params: { pack_id: string; price_string: string; currency: string; store_time_to_purchase_ms: number };
      }
    | {
          name: 'pack_purchase_failed';
          params: { pack_id: string; error_code: string; error_category: PurchaseErrorCategory };
      }
    | { name: 'purchases_restore_started'; params: { source: RestoreSource } }
    | { name: 'purchases_restore_completed'; params: { restored_count: number } }
    | { name: 'purchases_restore_failed'; params: { error_code: string; error_category: PurchaseErrorCategory } }
    | { name: 'premium_gate_hit'; params: { gate_type: GateType; item_id: string; game_id?: GameId } }
    | { name: 'theme_purchase_started'; params: { theme_id: string; price_string: string } }
    | { name: 'theme_purchase_completed'; params: { theme_id: string; price_string: string; currency: string } }
    | {
          name: 'theme_purchase_failed';
          params: { theme_id: string; error_code: string; error_category: PurchaseErrorCategory };
      }
    // --- Progression events ---
    | { name: 'level_up'; params: { from_level: number; to_level: number; lifetime_xp: number } }
    // --- Async Challenge events (ADR-0003). `game` is the kebab-case game id (e.g. `the-ladder`). ---
    | { name: 'challenge_created'; params: { game: string } }
    | { name: 'challenge_opened'; params: { game: string } }
    | { name: 'challenge_completed'; params: { game: string; progress: number; score: number } }
    | { name: 'challenge_update_required'; params: { game: string } }
    // --- Settings events ---
    | { name: 'language_changed'; params: { from_locale: string; to_locale: string } }
    | { name: 'theme_changed'; params: { theme_id: string; is_premium: boolean } }
    | { name: 'sound_effects_toggled'; params: { enabled: boolean } }
    | { name: 'haptics_toggled'; params: { enabled: boolean } }
    | { name: 'game_timer_changed'; params: { game_id: string; seconds: number } }
    | { name: 'legal_viewed'; params: { doc_type: DocType } };

export type AnalyticsEventName = AnalyticsEvent['name'];
export type EventParams<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>['params'];

export type AnalyticsUserProperty =
    | 'user_locale'
    | 'current_theme'
    | 'is_paying_user'
    | 'total_packs_owned'
    | 'has_completed_first_game';
