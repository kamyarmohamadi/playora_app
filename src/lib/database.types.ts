export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      catalog_games: {
        Row: {
          art_key: string
          catalog_visible: boolean
          category: string
          color: string
          created_at: string
          featured: boolean
          icon_key: string
          id: string
          is_enabled: boolean
          players_en: string
          players_fa: string
          subtitle_en: string
          subtitle_fa: string
          title_en: string
          title_fa: string
        }
        Insert: {
          art_key?: string
          catalog_visible?: boolean
          category: string
          color?: string
          created_at?: string
          featured?: boolean
          icon_key?: string
          id: string
          is_enabled?: boolean
          players_en?: string
          players_fa?: string
          subtitle_en?: string
          subtitle_fa?: string
          title_en: string
          title_fa: string
        }
        Update: {
          art_key?: string
          catalog_visible?: boolean
          category?: string
          color?: string
          created_at?: string
          featured?: boolean
          icon_key?: string
          id?: string
          is_enabled?: boolean
          players_en?: string
          players_fa?: string
          subtitle_en?: string
          subtitle_fa?: string
          title_en?: string
          title_fa?: string
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bucket: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coin_wallets: {
        Row: {
          created_at: string
          free_coins: number
          purchased_coins: number
          reward_coins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_coins?: number
          purchased_coins?: number
          reward_coins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_coins?: number
          purchased_coins?: number
          reward_coins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_network_configs: {
        Row: {
          asset_code: string
          coins_per_usd: number
          deposit_address: string
          hash_case_insensitive: boolean
          is_enabled: boolean
          min_amount: number
          network_code: string
          updated_at: string
          updated_by: string | null
          usd_per_asset: number
        }
        Insert: {
          asset_code: string
          coins_per_usd?: number
          deposit_address: string
          hash_case_insensitive?: boolean
          is_enabled?: boolean
          min_amount?: number
          network_code: string
          updated_at?: string
          updated_by?: string | null
          usd_per_asset: number
        }
        Update: {
          asset_code?: string
          coins_per_usd?: number
          deposit_address?: string
          hash_case_insensitive?: boolean
          is_enabled?: boolean
          min_amount?: number
          network_code?: string
          updated_at?: string
          updated_by?: string | null
          usd_per_asset?: number
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          asset_code: string
          coin_amount: number
          coins_per_usd_snapshot: number
          confirmations: number
          created_at: string
          credited_at: string | null
          credited_ledger_id: string | null
          destination_address_snapshot: string | null
          duplicate_of_request_id: string | null
          expected_amount: number
          id: string
          network_code: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_at: string | null
          tx_hash: string | null
          updated_at: string
          usd_per_asset_snapshot: number | null
          usd_value: number
          user_id: string
        }
        Insert: {
          asset_code: string
          coin_amount?: number
          coins_per_usd_snapshot?: number
          confirmations?: number
          created_at?: string
          credited_at?: string | null
          credited_ledger_id?: string | null
          destination_address_snapshot?: string | null
          duplicate_of_request_id?: string | null
          expected_amount: number
          id?: string
          network_code: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          usd_per_asset_snapshot?: number | null
          usd_value?: number
          user_id: string
        }
        Update: {
          asset_code?: string
          coin_amount?: number
          coins_per_usd_snapshot?: number
          confirmations?: number
          created_at?: string
          credited_at?: string | null
          credited_ledger_id?: string | null
          destination_address_snapshot?: string | null
          duplicate_of_request_id?: string | null
          expected_amount?: number
          id?: string
          network_code?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          usd_per_asset_snapshot?: number | null
          usd_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_credited_ledger_id_fkey"
            columns: ["credited_ledger_id"]
            isOneToOne: false
            referencedRelation: "coin_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_requests_duplicate_of_request_id_fkey"
            columns: ["duplicate_of_request_id"]
            isOneToOne: false
            referencedRelation: "deposit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_tx_duplicate_attempts: {
        Row: {
          attempted_at: string
          attempted_by: string
          duplicate_request_id: string
          first_request_id: string
          id: string
        }
        Insert: {
          attempted_at?: string
          attempted_by: string
          duplicate_request_id: string
          first_request_id: string
          id?: string
        }
        Update: {
          attempted_at?: string
          attempted_by?: string
          duplicate_request_id?: string
          first_request_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_tx_duplicate_attempts_duplicate_request_id_fkey"
            columns: ["duplicate_request_id"]
            isOneToOne: true
            referencedRelation: "deposit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_tx_duplicate_attempts_first_request_id_fkey"
            columns: ["first_request_id"]
            isOneToOne: false
            referencedRelation: "deposit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_tx_first_claims: {
        Row: {
          asset_code: string
          first_claimed_at: string
          first_request_id: string
          first_user_id: string
          network_code: string
          tx_hash_key: string
        }
        Insert: {
          asset_code: string
          first_claimed_at?: string
          first_request_id: string
          first_user_id: string
          network_code: string
          tx_hash_key: string
        }
        Update: {
          asset_code?: string
          first_claimed_at?: string
          first_request_id?: string
          first_user_id?: string
          network_code?: string
          tx_hash_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_tx_first_claims_first_request_id_fkey"
            columns: ["first_request_id"]
            isOneToOne: false
            referencedRelation: "deposit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      game_plugin_artifact_origins: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          is_approved: boolean
          origin: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          is_approved?: boolean
          origin: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          is_approved?: boolean
          origin?: string
        }
        Relationships: []
      }
      game_plugin_versions: {
        Row: {
          artifact_sha256: string
          created_at: string
          created_by: string | null
          enabled_at: string | null
          entrypoint_url: string
          game_id: string
          granted_capabilities: string[]
          id: string
          manifest: Json
          requested_capabilities: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          revoked_at: string | null
          sdk_max_exclusive: string
          sdk_min_version: string
          state: string
          updated_at: string
          version: string
        }
        Insert: {
          artifact_sha256: string
          created_at?: string
          created_by?: string | null
          enabled_at?: string | null
          entrypoint_url: string
          game_id: string
          granted_capabilities?: string[]
          id?: string
          manifest: Json
          requested_capabilities?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          revoked_at?: string | null
          sdk_max_exclusive: string
          sdk_min_version: string
          state?: string
          updated_at?: string
          version: string
        }
        Update: {
          artifact_sha256?: string
          created_at?: string
          created_by?: string | null
          enabled_at?: string | null
          entrypoint_url?: string
          game_id?: string
          granted_capabilities?: string[]
          id?: string
          manifest?: Json
          requested_capabilities?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          revoked_at?: string | null
          sdk_max_exclusive?: string
          sdk_min_version?: string
          state?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_plugin_versions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          final_result: string | null
          joined_at: string
          match_id: string
          seat: number
          user_id: string
        }
        Insert: {
          final_result?: string | null
          joined_at?: string
          match_id: string
          seat: number
          user_id: string
        }
        Update: {
          final_result?: string | null
          joined_at?: string
          match_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          economy_mode: string
          entry_coins: number
          finished_at: string | null
          game_id: string
          id: string
          mode: string
          server_state: Json
          started_at: string | null
          state_version: number
          status: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          economy_mode?: string
          entry_coins?: number
          finished_at?: string | null
          game_id: string
          id?: string
          mode: string
          server_state?: Json
          started_at?: string | null
          state_version?: number
          status?: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          economy_mode?: string
          entry_coins?: number
          finished_at?: string | null
          game_id?: string
          id?: string
          mode?: string
          server_state?: Json
          started_at?: string | null
          state_version?: number
          status?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string
          economy_mode: string
          game_id: string
          id: string
          match_id: string | null
          rating_snapshot: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          economy_mode?: string
          game_id: string
          id?: string
          match_id?: string | null
          rating_snapshot?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          economy_mode?: string
          game_id?: string
          id?: string
          match_id?: string | null
          rating_snapshot?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_queue_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_favorites: {
        Row: {
          created_at: string
          game_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_favorites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      member_game_stats: {
        Row: {
          competitive_rating: number
          draws: number
          economy_mode: string
          game_id: string
          losses: number
          matches_played: number
          updated_at: string
          user_id: string
          wins: number
          xp: number
        }
        Insert: {
          competitive_rating?: number
          draws?: number
          economy_mode?: string
          game_id: string
          losses?: number
          matches_played?: number
          updated_at?: string
          user_id: string
          wins?: number
          xp?: number
        }
        Update: {
          competitive_rating?: number
          draws?: number
          economy_mode?: string
          game_id?: string
          losses?: number
          matches_played?: number
          updated_at?: string
          user_id?: string
          wins?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_game_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      member_gate_verifications: {
        Row: {
          phone_verified: boolean
          telegram_verified: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
          wallet_verified: boolean
        }
        Insert: {
          phone_verified?: boolean
          telegram_verified?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
          wallet_verified?: boolean
        }
        Update: {
          phone_verified?: boolean
          telegram_verified?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          wallet_verified?: boolean
        }
        Relationships: []
      }
      member_payout_addresses: {
        Row: {
          asset_code: string
          id: string
          network_code: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string
          user_id: string
          verification_status: string
          wallet_address: string
        }
        Insert: {
          asset_code: string
          id?: string
          network_code: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          user_id: string
          verification_status?: string
          wallet_address: string
        }
        Update: {
          asset_code?: string
          id?: string
          network_code?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          user_id?: string
          verification_status?: string
          wallet_address?: string
        }
        Relationships: []
      }
      member_preferences: {
        Row: {
          locale: string
          reduced_motion: boolean
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          locale?: string
          reduced_motion?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          locale?: string
          reduced_motion?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          avatar_key: string | null
          created_at: string
          display_name: string
          locale: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_key?: string | null
          created_at?: string
          display_name?: string
          locale?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_key?: string | null
          created_at?: string
          display_name?: string
          locale?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      paid_coin_lot_consumptions: {
        Row: {
          amount: number
          created_at: string
          event_type: string
          id: string
          ledger_id: string
          lot_id: string
          match_id: string | null
          qualifies_for_turnover: boolean
          turnover_applied_at: string | null
          turnover_counted: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_type: string
          id?: string
          ledger_id: string
          lot_id: string
          match_id?: string | null
          qualifies_for_turnover?: boolean
          turnover_applied_at?: string | null
          turnover_counted?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          ledger_id?: string
          lot_id?: string
          match_id?: string | null
          qualifies_for_turnover?: boolean
          turnover_applied_at?: string | null
          turnover_counted?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_coin_lot_consumptions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "coin_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_coin_lot_consumptions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "paid_coin_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_coin_lot_consumptions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_coin_lots: {
        Row: {
          created_at: string
          credit_ledger_id: string
          id: string
          original_coins: number
          reference_id: string | null
          remaining_coins: number
          source_type: string
          turnover_completed: number
          turnover_required: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_ledger_id: string
          id?: string
          original_coins: number
          reference_id?: string | null
          remaining_coins: number
          source_type: string
          turnover_completed?: number
          turnover_required?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credit_ledger_id?: string
          id?: string
          original_coins?: number
          reference_id?: string | null
          remaining_coins?: number
          source_type?: string
          turnover_completed?: number
          turnover_required?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_coin_lots_credit_ledger_id_fkey"
            columns: ["credit_ledger_id"]
            isOneToOne: true
            referencedRelation: "coin_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      private_room_secrets: {
        Row: {
          created_at: string
          invite_code_hash: string
          room_id: string
        }
        Insert: {
          created_at?: string
          invite_code_hash: string
          room_id: string
        }
        Update: {
          created_at?: string
          invite_code_hash?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "private_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      private_rooms: {
        Row: {
          created_at: string
          economy_mode: string
          expires_at: string
          game_id: string
          host_user_id: string
          id: string
          match_id: string | null
          max_players: number
          status: string
        }
        Insert: {
          created_at?: string
          economy_mode?: string
          expires_at?: string
          game_id: string
          host_user_id: string
          id?: string
          match_id?: string | null
          max_players?: number
          status?: string
        }
        Update: {
          created_at?: string
          economy_mode?: string
          expires_at?: string
          game_id?: string
          host_user_id?: string
          id?: string
          match_id?: string | null
          max_players?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_rooms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_rooms_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          joined_at: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "private_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          request_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          request_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          request_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      social_action_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      support_reports: {
        Row: {
          app_version: string
          category: string
          created_at: string
          description: string
          diagnostics: Json
          id: string
          idempotency_key: string
          locale: string
          route_key: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version: string
          category: string
          created_at?: string
          description: string
          diagnostics: Json
          id?: string
          idempotency_key: string
          locale: string
          route_key: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          app_version?: string
          category?: string
          created_at?: string
          description?: string
          diagnostics?: Json
          id?: string
          idempotency_key?: string
          locale?: string
          route_key?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          created_at: string
          final_place: number | null
          status: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          final_place?: number | null
          status?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          final_place?: number | null
          status?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          entry_coins: number
          game_id: string
          id: string
          reward_policy: string
          starts_at: string | null
          status: string
          title_en: string
          title_fa: string
        }
        Insert: {
          created_at?: string
          entry_coins?: number
          game_id: string
          id?: string
          reward_policy?: string
          starts_at?: string | null
          status?: string
          title_en: string
          title_fa: string
        }
        Update: {
          created_at?: string
          entry_coins?: number
          game_id?: string
          id?: string
          reward_policy?: string
          starts_at?: string | null
          status?: string
          title_en?: string
          title_fa?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_network_configs: {
        Row: {
          asset_code: string
          is_enabled: boolean
          network_code: string
          network_fee_asset: number
          updated_at: string
          updated_by: string | null
          usd_per_asset: number
        }
        Insert: {
          asset_code: string
          is_enabled?: boolean
          network_code: string
          network_fee_asset?: number
          updated_at?: string
          updated_by?: string | null
          usd_per_asset: number
        }
        Update: {
          asset_code?: string
          is_enabled?: boolean
          network_code?: string
          network_fee_asset?: number
          updated_at?: string
          updated_by?: string | null
          usd_per_asset?: number
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          actual_asset_amount: number | null
          asset_code: string
          coins_per_usd_snapshot: number
          created_at: string
          destination_address: string
          gross_asset_amount: number
          id: string
          net_asset_amount: number
          network_code: string
          network_fee_asset_amount: number
          paid_at: string | null
          payout_tx_hash: string | null
          requested_coins: number
          reserve_ledger_id: string | null
          review_note: string | null
          reviewed_at: string | null
          status: string
          updated_at: string
          usd_per_asset_snapshot: number
          user_id: string
        }
        Insert: {
          actual_asset_amount?: number | null
          asset_code: string
          coins_per_usd_snapshot?: number
          created_at?: string
          destination_address: string
          gross_asset_amount: number
          id?: string
          net_asset_amount: number
          network_code: string
          network_fee_asset_amount: number
          paid_at?: string | null
          payout_tx_hash?: string | null
          requested_coins: number
          reserve_ledger_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          usd_per_asset_snapshot: number
          user_id: string
        }
        Update: {
          actual_asset_amount?: number | null
          asset_code?: string
          coins_per_usd_snapshot?: number
          created_at?: string
          destination_address?: string
          gross_asset_amount?: number
          id?: string
          net_asset_amount?: number
          network_code?: string
          network_fee_asset_amount?: number
          paid_at?: string | null
          payout_tx_hash?: string | null
          requested_coins?: number
          reserve_ledger_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          usd_per_asset_snapshot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_reserve_ledger_id_fkey"
            columns: ["reserve_ledger_id"]
            isOneToOne: false
            referencedRelation: "coin_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_coin_delta: {
        Args: {
          p_amount: number
          p_bucket: string
          p_event_type: string
          p_idempotency_key: string
          p_reference_id?: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          free_coins: number
          purchased_coins: number
          reward_coins: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "coin_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_random_match_queue: {
        Args: { p_game_id: string }
        Returns: boolean
      }
      complete_paid_match_turnover: {
        Args: { p_match_id: string }
        Returns: number
      }
      create_private_room: {
        Args: { p_game_id: string; p_max_players?: number }
        Returns: {
          created_room_id: string
          invite_code: string
          room_expires_at: string
        }[]
      }
      find_tictactoe_winner: { Args: { p_board: Json }; Returns: string }
      get_deposit_options: {
        Args: never
        Returns: {
          asset_code: string
          coins_per_usd: number
          deposit_address: string
          min_amount: number
          network_code: string
          usd_per_asset: number
        }[]
      }
      get_game_leaderboard: {
        Args: { p_game_id?: string; p_limit?: number }
        Returns: {
          competitive_rating: number
          display_name: string
          draws: number
          losses: number
          matches_played: number
          rank_position: number
          updated_at: string
          username: string
          wins: number
          xp: number
        }[]
      }
      get_game_leaderboard_for_mode: {
        Args: { p_economy_mode: string; p_game_id: string; p_limit?: number }
        Returns: {
          competitive_rating: number
          display_name: string
          draws: number
          losses: number
          matches_played: number
          rank_position: number
          updated_at: string
          username: string
          wins: number
          xp: number
        }[]
      }
      get_member_game_access: {
        Args: { p_game_id: string }
        Returns: {
          free_level: number
          lifetime_deposit_coins: number
          paid_level: number
          paid_private_unlocked: boolean
          paid_random_unlocked: boolean
          phone_verified: boolean
          telegram_verified: boolean
          wallet_verified: boolean
        }[]
      }
      get_my_financial_summary: {
        Args: never
        Returns: {
          daily_withdrawal_remaining: number
          lifetime_deposit_coins: number
          turnover_completed: number
          turnover_remaining: number
          turnover_required: number
          value_wallet_coins: number
          weekly_withdrawal_remaining: number
        }[]
      }
      get_withdrawal_options: {
        Args: never
        Returns: {
          asset_code: string
          network_code: string
          network_fee_asset: number
          usd_per_asset: number
        }[]
      }
      hash_room_invite_code: { Args: { p_code: string }; Returns: string }
      join_private_room: {
        Args: { p_invite_code: string }
        Returns: {
          active_match_id: string
          joined_game_id: string
          joined_room_id: string
          room_expires_at: string
          room_status: string
        }[]
      }
      leave_private_room: { Args: { p_room_id: string }; Returns: boolean }
      list_social_relationships: {
        Args: never
        Returns: {
          created_at: string
          other_display_name: string
          other_username: string
          relationship_type: string
          request_id: string
          request_status: string
        }[]
      }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      queue_for_random_match: {
        Args: { p_game_id: string }
        Returns: {
          matched_match_id: string
          queue_status: string
        }[]
      }
      register_member_payout_address: {
        Args: {
          p_asset_code: string
          p_network_code: string
          p_wallet_address: string
        }
        Returns: string
      }
      request_withdrawal: {
        Args: { p_payout_address_id: string; p_requested_coins: number }
        Returns: string
      }
      respond_friend_request: {
        Args: { p_action: string; p_request_id: string }
        Returns: {
          relationship_status: string
          request_id: string
        }[]
      }
      review_deposit_request: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_review_note?: string
        }
        Returns: {
          asset_code: string
          coin_amount: number
          coins_per_usd_snapshot: number
          confirmations: number
          created_at: string
          credited_at: string | null
          credited_ledger_id: string | null
          destination_address_snapshot: string | null
          duplicate_of_request_id: string | null
          expected_amount: number
          id: string
          network_code: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_at: string | null
          tx_hash: string | null
          updated_at: string
          usd_per_asset_snapshot: number | null
          usd_value: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposit_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_member_payout_address: {
        Args: {
          p_address_id: string
          p_approved: boolean
          p_review_note?: string
        }
        Returns: boolean
      }
      review_withdrawal_request: {
        Args: {
          p_action: string
          p_actual_asset_amount?: number
          p_payout_tx_hash?: string
          p_request_id: string
          p_review_note?: string
        }
        Returns: {
          actual_asset_amount: number | null
          asset_code: string
          coins_per_usd_snapshot: number
          created_at: string
          destination_address: string
          gross_asset_amount: number
          id: string
          net_asset_amount: number
          network_code: string
          network_fee_asset_amount: number
          paid_at: string | null
          payout_tx_hash: string | null
          requested_coins: number
          reserve_ledger_id: string | null
          review_note: string | null
          reviewed_at: string | null
          status: string
          updated_at: string
          usd_per_asset_snapshot: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_friend_request: {
        Args: { p_username: string }
        Returns: {
          relationship_status: string
          request_id: string
        }[]
      }
      set_member_gate_verification: {
        Args: {
          p_phone_verified: boolean
          p_telegram_verified: boolean
          p_user_id: string
          p_wallet_verified: boolean
        }
        Returns: undefined
      }
      submit_deposit_claim: {
        Args: {
          p_amount: number
          p_asset_code: string
          p_network_code: string
          p_transaction_at: string
          p_tx_hash: string
        }
        Returns: string
      }
      submit_private_tictactoe_move: {
        Args: { p_cell_index: number; p_match_id: string }
        Returns: Json
      }
      submit_tictactoe_move: {
        Args: { p_cell_index: number; p_match_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
