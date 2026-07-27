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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          list_type: string
          name: string
          slug: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string
          name: string
          slug: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string
          name?: string
          slug?: string
          version?: string | null
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          completed_at: string | null
          correct_count: number
          id: string
          incorrect_count: number
          new_words_count: number
          reviewed_words_count: number
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_count?: number
          id?: string
          incorrect_count?: number
          new_words_count?: number
          reviewed_words_count?: number
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_count?: number
          id?: string
          incorrect_count?: number
          new_words_count?: number
          reviewed_words_count?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_new_word_target: number
          default_list_id: string | null
          preferred_audio_speed: number
          streak_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_new_word_target?: number
          default_list_id?: string | null
          preferred_audio_speed?: number
          streak_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_new_word_target?: number
          default_list_id?: string | null
          preferred_audio_speed?: number
          streak_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_list_id_fkey"
            columns: ["default_list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_word_progress: {
        Row: {
          correct_count: number
          created_at: string
          due_at: string
          ease_factor: number
          id: string
          incorrect_count: number
          interval_days: number
          last_reviewed_at: string | null
          meaning_correct_count: number
          meaning_incorrect_count: number
          pronunciation_correct_count: number
          pronunciation_incorrect_count: number
          repetitions: number
          review_count: number
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          incorrect_count?: number
          interval_days?: number
          last_reviewed_at?: string | null
          meaning_correct_count?: number
          meaning_incorrect_count?: number
          pronunciation_correct_count?: number
          pronunciation_incorrect_count?: number
          repetitions?: number
          review_count?: number
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          due_at?: string
          ease_factor?: number
          id?: string
          incorrect_count?: number
          interval_days?: number
          last_reviewed_at?: string | null
          meaning_correct_count?: number
          meaning_incorrect_count?: number
          pronunciation_correct_count?: number
          pronunciation_incorrect_count?: number
          repetitions?: number
          review_count?: number
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_word_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_lists: {
        Row: {
          list_id: string
          position: number
          word_id: string
        }
        Insert: {
          list_id: string
          position?: number
          word_id: string
        }
        Update: {
          list_id?: string
          position?: number
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_lists_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_lists_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          audio_provider: string | null
          audio_url: string | null
          audio_voice: string | null
          classifier: string | null
          created_at: string
          english_meaning: string
          example_sentence: string | null
          example_translation: string | null
          id: string
          part_of_speech: string | null
          pinyin: string
          pinyin_numeric: string | null
          simplified: string
          source: string | null
          source_license: string | null
        }
        Insert: {
          audio_provider?: string | null
          audio_url?: string | null
          audio_voice?: string | null
          classifier?: string | null
          created_at?: string
          english_meaning: string
          example_sentence?: string | null
          example_translation?: string | null
          id?: string
          part_of_speech?: string | null
          pinyin: string
          pinyin_numeric?: string | null
          simplified: string
          source?: string | null
          source_license?: string | null
        }
        Update: {
          audio_provider?: string | null
          audio_url?: string | null
          audio_voice?: string | null
          classifier?: string | null
          created_at?: string
          english_meaning?: string
          example_sentence?: string | null
          example_translation?: string | null
          id?: string
          part_of_speech?: string | null
          pinyin?: string
          pinyin_numeric?: string | null
          simplified?: string
          source?: string | null
          source_license?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      progress_status: "new" | "learning" | "review" | "mastered"
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
      progress_status: ["new", "learning", "review", "mastered"],
    },
  },
} as const
