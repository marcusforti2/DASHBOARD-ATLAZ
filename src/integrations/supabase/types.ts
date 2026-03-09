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
      agent_interactions: {
        Row: {
          agent_type: string
          created_at: string | null
          feedback_rating: number | null
          feedback_text: string | null
          id: string
          member_id: string
          query: string
          response_preview: string | null
          response_time_ms: number | null
          tool_used: string
        }
        Insert: {
          agent_type?: string
          created_at?: string | null
          feedback_rating?: number | null
          feedback_text?: string | null
          id?: string
          member_id: string
          query: string
          response_preview?: string | null
          response_time_ms?: number | null
          tool_used?: string
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          feedback_rating?: number | null
          feedback_text?: string | null
          id?: string
          member_id?: string
          query?: string
          response_preview?: string | null
          response_time_ms?: number | null
          tool_used?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_interactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          access_count: number | null
          agent_type: string
          content: string
          created_at: string | null
          id: string
          importance_score: number | null
          last_accessed: string | null
          member_id: string
          memory_type: string
        }
        Insert: {
          access_count?: number | null
          agent_type?: string
          content: string
          created_at?: string | null
          id?: string
          importance_score?: number | null
          last_accessed?: string | null
          member_id: string
          memory_type?: string
        }
        Update: {
          access_count?: number | null
          agent_type?: string
          content?: string
          created_at?: string | null
          id?: string
          importance_score?: number | null
          last_accessed?: string | null
          member_id?: string
          memory_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
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
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          model: string
          prompt_hash: string
          response: string
          tokens_used: number | null
          tool: string
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          model?: string
          prompt_hash: string
          response: string
          tokens_used?: number | null
          tool?: string
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          model?: string
          prompt_hash?: string
          response?: string
          tokens_used?: number | null
          tool?: string
        }
        Relationships: []
      }
      ai_tool_usage: {
        Row: {
          created_at: string
          id: string
          member_id: string
          tool_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          tool_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          tool_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_usage_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      coach_conversations: {
        Row: {
          created_at: string
          id: string
          member_id: string
          title: string
          tool: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          title?: string
          tool?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          title?: string
          tool?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "coach_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge: {
        Row: {
          active: boolean
          category: string
          content: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          content: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      dna_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          submission_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          submission_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dna_chat_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "test_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          created_at: string
          created_by: string
          event_description: string | null
          event_google_id: string
          event_start_at: string
          event_title: string
          id: string
          lead_name: string | null
          lead_phone: string | null
          remind_at: string
          reminder_label: string
          reminder_type: string
          sent: boolean
          sent_at: string | null
          team_member_ids: string[] | null
        }
        Insert: {
          created_at?: string
          created_by: string
          event_description?: string | null
          event_google_id: string
          event_start_at: string
          event_title: string
          id?: string
          lead_name?: string | null
          lead_phone?: string | null
          remind_at: string
          reminder_label?: string
          reminder_type?: string
          sent?: boolean
          sent_at?: string | null
          team_member_ids?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string
          event_description?: string | null
          event_google_id?: string
          event_start_at?: string
          event_title?: string
          id?: string
          lead_name?: string | null
          lead_phone?: string | null
          remind_at?: string
          reminder_label?: string
          reminder_type?: string
          sent?: boolean
          sent_at?: string | null
          team_member_ids?: string[] | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_email: string | null
          created_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_email?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_email?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          created_at: string
          drive_email: string | null
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          drive_email?: string | null
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          drive_email?: string | null
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          lead_name: string
          member_id: string
          metric_type: string | null
          social_link: string | null
          source: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          lead_name?: string
          member_id: string
          metric_type?: string | null
          social_link?: string | null
          source?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lead_name?: string
          member_id?: string
          metric_type?: string | null
          social_link?: string | null
          source?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      motivational_popups: {
        Row: {
          active: boolean
          category: string
          created_at: string
          emoji: string | null
          frequency_minutes: number | null
          id: string
          message: string
          target_role: string | null
          time_range_end: string | null
          time_range_start: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          emoji?: string | null
          frequency_minutes?: number | null
          id?: string
          message: string
          target_role?: string | null
          time_range_end?: string | null
          time_range_start?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          emoji?: string | null
          frequency_minutes?: number | null
          id?: string
          message?: string
          target_role?: string | null
          time_range_end?: string | null
          time_range_start?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      proactive_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          data: Json | null
          id: string
          member_id: string
          message: string
          read: boolean | null
          sent_via_whatsapp: boolean | null
          severity: string
          title: string
        }
        Insert: {
          alert_type?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          member_id: string
          message: string
          read?: boolean | null
          sent_via_whatsapp?: boolean | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          member_id?: string
          message?: string
          read?: boolean | null
          sent_via_whatsapp?: boolean | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_alerts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      process_flows: {
        Row: {
          created_at: string
          description: string | null
          edges: Json
          id: string
          is_public: boolean
          name: string
          nodes: Json
          public_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          name: string
          nodes?: Json
          public_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          name?: string
          nodes?: Json
          public_token?: string | null
          updated_at?: string
          user_id?: string
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
      test_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: number
          submission_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: number
          submission_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "test_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          member_id: string | null
          test_type: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          member_id?: string | null
          test_type?: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          member_id?: string | null
          test_type?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      test_submissions: {
        Row: {
          ai_analysis: Json | null
          completed_at: string | null
          created_at: string
          id: string
          member_id: string | null
          respondent_email: string | null
          respondent_name: string | null
          respondent_phone: string | null
          status: string
          test_link_id: string | null
          test_type: string
        }
        Insert: {
          ai_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          status?: string
          test_link_id?: string | null
          test_type?: string
        }
        Update: {
          ai_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          status?: string
          test_link_id?: string | null
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_test_link_id_fkey"
            columns: ["test_link_id"]
            isOneToOne: false
            referencedRelation: "test_links"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          drive_folder_id: string | null
          id: string
          published: boolean
          published_at: string | null
          sort_order: number
          target_role: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          sort_order?: number
          target_role?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          sort_order?: number
          target_role?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_lessons: {
        Row: {
          assigned_admin_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          drive_folder_id: string | null
          duration_seconds: number | null
          id: string
          module_id: string
          sort_order: number
          title: string
          video_type: string
          video_url: string
        }
        Insert: {
          assigned_admin_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          duration_seconds?: number | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          video_type?: string
          video_url: string
        }
        Update: {
          assigned_admin_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          duration_seconds?: number | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          video_type?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_lessons_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          drive_folder_id: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          drive_folder_id?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_notifications: {
        Row: {
          course_id: string
          created_at: string
          id: string
          message: string
          target_role: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          message?: string
          target_role?: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          message?: string
          target_role?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_playbooks: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          target_role: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          target_role?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          target_role?: string
          title?: string
          updated_at?: string
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
      wa_contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          instance_id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          instance_id: string
          name?: string
          phone: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          id: string
          instance_id: string
          last_message: string | null
          last_message_at: string | null
          lead_status: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          id?: string
          instance_id: string
          last_message?: string | null
          last_message_at?: string | null
          lead_status?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_status?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_instances: {
        Row: {
          closer_id: string | null
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          closer_id?: string | null
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          closer_id?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_instances_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          conversation_id: string
          created_at: string
          id: string
          instance_id: string | null
          sender: string
          text: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          instance_id?: string | null
          sender?: string
          text?: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          sender?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_automations: {
        Row: {
          active: boolean
          created_at: string
          description: string
          flow_data: Json | null
          id: string
          include_ai_tips: boolean
          include_metrics: boolean
          message_template: string
          name: string
          schedule_cron: string | null
          target_audience: string
          target_role: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          flow_data?: Json | null
          id?: string
          include_ai_tips?: boolean
          include_metrics?: boolean
          message_template: string
          name: string
          schedule_cron?: string | null
          target_audience?: string
          target_role?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          flow_data?: Json | null
          id?: string
          include_ai_tips?: boolean
          include_metrics?: boolean
          message_template?: string
          name?: string
          schedule_cron?: string | null
          target_audience?: string
          target_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          phone: string
          team_member_id: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          phone: string
          team_member_id?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          phone?: string
          team_member_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
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
      get_test_link_by_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          member_id: string | null
          test_type: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "test_links"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
