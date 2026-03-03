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
          month_id?: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: true
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
      team_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      weekly_goals: {
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
          month_id: string
          numero: number
          reuniao_agendada: number
          reuniao_realizada: number
          week_number: number
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
          month_id: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          week_number: number
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
          month_id?: string
          numero?: number
          reuniao_agendada?: number
          reuniao_realizada?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_goals_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
