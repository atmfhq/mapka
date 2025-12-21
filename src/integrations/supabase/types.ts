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
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string
          status: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string
          status?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string
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
      invitations: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      megaphones: {
        Row: {
          category: string
          created_at: string | null
          duration_minutes: number
          host_id: string
          id: string
          is_private: boolean
          lat: number
          lng: number
          max_participants: number | null
          start_time: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          duration_minutes?: number
          host_id: string
          id?: string
          is_private?: boolean
          lat: number
          lng: number
          max_participants?: number | null
          start_time: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          duration_minutes?: number
          host_id?: string
          id?: string
          is_private?: boolean
          lat?: number
          lng?: number
          max_participants?: number | null
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
      profiles: {
        Row: {
          avatar_config: Json | null
          avatar_url: string | null
          base_lat: number | null
          base_lng: number | null
          bio: string | null
          created_at: string | null
          id: string
          is_onboarded: boolean | null
          nick: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          avatar_config?: Json | null
          avatar_url?: string | null
          base_lat?: number | null
          base_lng?: number | null
          bio?: string | null
          created_at?: string | null
          id: string
          is_onboarded?: boolean | null
          nick?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          avatar_config?: Json | null
          avatar_url?: string | null
          base_lat?: number | null
          base_lng?: number | null
          bio?: string | null
          created_at?: string | null
          id?: string
          is_onboarded?: boolean | null
          nick?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_category: string
          p_invitation_id: string
          p_lat: number
          p_lng: number
          p_title: string
        }
        Returns: string
      }
      can_view_megaphone: {
        Args: {
          megaphone_row: Database["public"]["Tables"]["megaphones"]["Row"]
        }
        Returns: boolean
      }
      is_event_member: {
        Args: { event_uuid: string; user_uuid: string }
        Returns: boolean
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
    Enums: {},
  },
} as const
