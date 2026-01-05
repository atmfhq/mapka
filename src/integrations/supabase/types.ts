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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      connections: {
        Row: {
          created_at: string
          id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          invitation_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          invitation_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          invitation_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_messages: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
        ]
      }
      event_likes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          chat_active: boolean
          event_id: string
          id: string
          is_chat_banned: boolean
          joined_at: string
          last_read_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          chat_active?: boolean
          event_id: string
          id?: string
          is_chat_banned?: boolean
          joined_at?: string
          last_read_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          chat_active?: boolean
          event_id?: string
          id?: string
          is_chat_banned?: boolean
          joined_at?: string
          last_read_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hidden_shouts: {
        Row: {
          created_at: string
          id: string
          shout_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shout_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shout_id?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          last_read_at: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          activity_type?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      megaphones: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          external_link: string | null
          host_id: string
          id: string
          is_hidden: boolean
          is_official: boolean
          is_private: boolean
          lat: number
          lng: number
          location_details: string | null
          max_participants: number | null
          organizer_display_name: string | null
          share_code: string
          start_time: string
          title: string
        }
        Insert: {
          category: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          external_link?: string | null
          host_id: string
          id?: string
          is_hidden?: boolean
          is_official?: boolean
          is_private?: boolean
          lat: number
          lng: number
          location_details?: string | null
          max_participants?: number | null
          organizer_display_name?: string | null
          share_code: string
          start_time: string
          title: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          external_link?: string | null
          host_id?: string
          id?: string
          is_hidden?: boolean
          is_official?: boolean
          is_private?: boolean
          lat?: number
          lng?: number
          location_details?: string | null
          max_participants?: number | null
          organizer_display_name?: string | null
          share_code?: string
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "megaphones_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "event_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_chats: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          invitation_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          invitation_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          invitation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muted_chats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_chats_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          resource_id: string
          trigger_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          resource_id: string
          trigger_user_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          resource_id?: string
          trigger_user_id?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_config: Json | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string
          is_18_plus: boolean
          is_active: boolean
          is_onboarded: boolean | null
          last_bounce_at: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          nick: string | null
          notification_preferences: Json
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          account_status?: string
          avatar_config?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id: string
          is_18_plus?: boolean
          is_active?: boolean
          is_onboarded?: boolean | null
          last_bounce_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          nick?: string | null
          notification_preferences?: Json
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          account_status?: string
          avatar_config?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          is_18_plus?: boolean
          is_active?: boolean
          is_onboarded?: boolean | null
          last_bounce_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          nick?: string | null
          notification_preferences?: Json
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          target_event_id: string | null
          target_shout_id: string | null
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          target_event_id?: string | null
          target_shout_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          target_event_id?: string | null
          target_shout_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_shout_id_fkey"
            columns: ["target_shout_id"]
            isOneToOne: false
            referencedRelation: "shouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rpc_rate_limits: {
        Row: {
          call_count: number
          function_name: string
          user_id: string
          window_start: string
        }
        Insert: {
          call_count?: number
          function_name: string
          user_id: string
          window_start?: string
        }
        Update: {
          call_count?: number
          function_name?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      shout_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shout_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "shout_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      shout_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          shout_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          shout_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          shout_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shout_comments_shout_id_fkey"
            columns: ["shout_id"]
            isOneToOne: false
            referencedRelation: "shouts"
            referencedColumns: ["id"]
          },
        ]
      }
      shout_likes: {
        Row: {
          created_at: string
          id: string
          shout_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shout_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shout_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shout_likes_shout_id_fkey"
            columns: ["shout_id"]
            isOneToOne: false
            referencedRelation: "shouts"
            referencedColumns: ["id"]
          },
        ]
      }
      shouts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      spot_bans: {
        Row: {
          banned_by: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_bans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "spot_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          spot_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          spot_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          spot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_comments_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "megaphones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_global_unread_count: {
        Args: { p_user_id: string };
        Returns: number;
      }
      accept_invitation:
        | { Args: { p_invitation_id: string }; Returns: undefined }
        | {
            Args: {
              p_category: string
              p_invitation_id: string
              p_lat: number
              p_lng: number
              p_title: string
            }
            Returns: string
          }
      can_message_in_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_megaphone: {
        Args: {
          megaphone_row: Database["public"]["Tables"]["megaphones"]["Row"]
        }
        Returns: boolean
      }
      check_megaphone_access: {
        Args: { megaphone_id: string; user_id: string }
        Returns: boolean
      }
      check_participant_access: {
        Args: {
          participant_event_id: string
          participant_user_id: string
          requesting_user_id: string
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { func_name: string; max_calls: number; window_seconds: number }
        Returns: undefined
      }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      delete_user_account: { Args: never; Returns: undefined }
      generate_share_code: { Args: never; Returns: string }
      get_current_user_location: {
        Args: never
        Returns: {
          lat: number
          lng: number
        }[]
      }
      get_nearby_megaphones: {
        Args: { p_lat: number; p_lng: number; p_radius_meters?: number }
        Returns: {
          category: string
          cover_image_url: string
          created_at: string
          description: string
          duration_minutes: number
          external_link: string
          host_id: string
          id: string
          is_official: boolean
          is_private: boolean
          lat: number
          lng: number
          location_details: string
          max_participants: number
          organizer_display_name: string
          share_code: string
          start_time: string
          title: string
        }[]
      }
      get_nearby_profiles: {
        Args: { p_lat: number; p_lng: number; p_radius_meters?: number }
        Returns: {
          avatar_config: Json
          avatar_url: string
          bio: string
          id: string
          is_active: boolean
          last_bounce_at: string
          location_lat: number
          location_lng: number
          nick: string
          tags: string[]
        }[]
      }
      get_nearby_shouts: {
        Args: { p_lat: number; p_lng: number; p_radius_meters?: number }
        Returns: {
          content: string
          created_at: string
          id: string
          lat: number
          lng: number
          user_id: string
        }[]
      }
      get_profile_display: {
        Args: { p_user_id: string }
        Returns: {
          avatar_config: Json
          avatar_url: string
          bio: string
          id: string
          nick: string
          tags: string[]
        }[]
      }
      get_profiles_display: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_config: Json
          avatar_url: string
          bio: string
          id: string
          nick: string
          tags: string[]
        }[]
      }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_config: Json
          avatar_url: string
          bio: string
          id: string
          is_active: boolean
          location_lat: number
          location_lng: number
          nick: string
          tags: string[]
        }[]
      }
      get_public_profiles_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_config: Json
          avatar_url: string
          bio: string
          id: string
          is_active: boolean
          location_lat: number
          location_lng: number
          nick: string
          tags: string[]
        }[]
      }
      get_unread_message_count: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned_from_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_chat_banned_from_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_member: {
        Args: { event_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_invitation_member: {
        Args: { p_invitation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_profile_within_radius: {
        Args: { radius_meters?: number; target_lat: number; target_lng: number }
        Returns: boolean
      }
      resolve_megaphone_link: {
        Args: { p_id?: string; p_share_code?: string }
        Returns: {
          category: string
          cover_image_url: string | null
          description: string | null
          duration_minutes: number
          external_link: string | null
          host_id: string
          id: string
          is_official: boolean | null
          is_private: boolean | null
          lat: number
          lng: number
          location_details: string | null
          max_participants: number | null
          organizer_display_name: string | null
          share_code: string
          start_time: string
          title: string
        }[]
      }
      sanitize_text_input: { Args: { input_text: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
