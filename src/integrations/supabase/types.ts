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
      admin_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      ai_reports: {
        Row: {
          content: string
          generated_at: string
          id: string
          month_id: string
          report_type: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          month_id: string
          report_type?: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          month_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_analyses: {
        Row: {
          ai_analysis: string | null
          analysis_type: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: string | null
          analysis_type?: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: string | null
          analysis_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_analyses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          abordagens: number
          conexoes: number
          conexoes_aceitas: number
          created_at: string
          date: string
          day_of_week: string
          follow_up: number
          id: string
          inmail: number
          lig_agendada: number
          lig_realizada: number
          member_id: string
          month_id: string
          numero: number
          reuniao_agendada: number
          reuniao_realizada: number
          updated_at: string
        }
        Insert: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          date: string
          day_of_week: string
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id: string
          month_id: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          updated_at?: string
        }
        Update: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          date?: string
          day_of_week?: string
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id?: string
          month_id?: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          abordagens: number
          conexoes: number
          conexoes_aceitas: number
          created_at: string
          follow_up: number
          id: string
          inmail: number
          lig_agendada: number
          lig_realizada: number
          member_id: string | null
          month_id: string
          numero: number
          reuniao_agendada: number
          reuniao_realizada: number
        }
        Insert: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id?: string | null
          month_id: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
        }
        Update: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id?: string | null
          month_id?: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_goals_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          created_at: string
          id: string
          label: string
          month: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          month: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          month?: number
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          id: string
          member_role: string
          name: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          member_role?: string
          name: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          member_role?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_goals: {
        Row: {
          abordagens: number
          conexoes: number
          conexoes_aceitas: number
          created_at: string
          end_date: string | null
          follow_up: number
          id: string
          inmail: number
          lig_agendada: number
          lig_realizada: number
          member_id: string | null
          month_id: string
          numero: number
          reuniao_agendada: number
          reuniao_realizada: number
          start_date: string | null
          week_number: number
          working_days: string
        }
        Insert: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          end_date?: string | null
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id?: string | null
          month_id: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          start_date?: string | null
          week_number: number
          working_days?: string
        }
        Update: {
          abordagens?: number
          conexoes?: number
          conexoes_aceitas?: number
          created_at?: string
          end_date?: string | null
          follow_up?: number
          id?: string
          inmail?: number
          lig_agendada?: number
          lig_realizada?: number
          member_id?: string | null
          month_id?: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          start_date?: string | null
          week_number?: number
          working_days?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_goals_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          phone: string
          team_member_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          phone: string
          team_member_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          phone?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_team_member_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "closer" | "sdr"
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
      app_role: ["admin", "closer", "sdr"],
    },
  },
} as const
