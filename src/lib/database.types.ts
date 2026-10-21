// Generated from Supabase project playora-dev (nnowvfewtrfurnluhflt), EU Central.
// Snapshot date: 2026-10-22. Regenerate after database migrations.
// Do not hand-edit generated schema types; review schema changes in migrations first.

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
      deposit_requests: {
        Row: {
          asset_code: string
          confirmations: number
          created_at: string
          credited_at: string | null
          expected_amount: number
          id: string
          network_code: string
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_code: string
          confirmations?: number
          created_at?: string
          credited_at?: string | null
          expected_amount: number
          id?: string
          network_code: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_code?: string
          confirmations?: number
          created_at?: string
          credited_at?: string | null
          expected_amount?: number
          id?: string
          network_code?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      create_private_room: {
        Args: { p_game_id: string; p_max_players?: number }
        Returns: {
          created_room_id: string
          invite_code: string
          room_expires_at: string
        }[]
      }
      find_tictactoe_winner: { Args: { p_board: Json }; Returns: string }
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
      respond_friend_request: {
        Args: { p_action: string; p_request_id: string }
        Returns: {
          relationship_status: string
          request_id: string
        }[]
      }
      send_friend_request: {
        Args: { p_username: string }
        Returns: {
          relationship_status: string
          request_id: string
        }[]
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
