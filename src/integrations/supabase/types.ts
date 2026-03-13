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
      automation_actions: {
        Row: {
          action_payload: Json
          action_type: string
          campaign_id: string
          contact_id: string
          created_at: string
          enrollment_id: string
          executed_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          retry_count: number
          scheduled_for: string
          status: string
          step_index: number
        }
        Insert: {
          action_payload?: Json
          action_type?: string
          campaign_id: string
          contact_id: string
          created_at?: string
          enrollment_id: string
          executed_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          retry_count?: number
          scheduled_for?: string
          status?: string
          step_index?: number
        }
        Update: {
          action_payload?: Json
          action_type?: string
          campaign_id?: string
          contact_id?: string
          created_at?: string
          enrollment_id?: string
          executed_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          retry_count?: number
          scheduled_for?: string
          status?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_enrollments: {
        Row: {
          campaign_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          contact_id: string
          conversation_id: string | null
          current_step: number
          enrolled_at: string
          id: string
          metadata: Json
          status: string
        }
        Insert: {
          campaign_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_id: string
          conversation_id?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          metadata?: Json
          status?: string
        }
        Update: {
          campaign_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_id?: string
          conversation_id?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          metadata?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string
          enrollment_id: string | null
          event_type: string
          id: string
          payload: Json
          provider_event_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          enrollment_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          provider_event_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          enrollment_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          instance_id: string
          name: string
          status: string
          steps: Json
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          instance_id: string
          name: string
          status?: string
          steps?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          status?: string
          steps?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
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
      contact_suppressions: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          phone: string
          reason: string
          source: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          phone: string
          reason?: string
          source?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          phone?: string
          reason?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_suppressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
      email_flow_contacts: {
        Row: {
          created_at: string
          email: string
          flow_id: string
          id: string
          name: string | null
          source_file: string | null
        }
        Insert: {
          created_at?: string
          email: string
          flow_id: string
          id?: string
          name?: string | null
          source_file?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          flow_id?: string
          id?: string
          name?: string | null
          source_file?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_flow_contacts_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      email_flow_executions: {
        Row: {
          completed_at: string | null
          error_message: string | null
          flow_id: string
          id: string
          member_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          flow_id: string
          id?: string
          member_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          flow_id?: string
          id?: string
          member_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_flow_executions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_flows: {
        Row: {
          audience_member_ids: string[] | null
          audience_type: string
          created_at: string
          description: string | null
          edges: Json
          id: string
          is_active: boolean
          name: string
          nodes: Json
          updated_at: string
        }
        Insert: {
          audience_member_ids?: string[] | null
          audience_type?: string
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_active?: boolean
          name: string
          nodes?: Json
          updated_at?: string
        }
        Update: {
          audience_member_ids?: string[] | null
          audience_type?: string
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_active?: boolean
          name?: string
          nodes?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_send_logs: {
        Row: {
          error_message: string | null
          flow_id: string
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          status: string
          subject: string
        }
        Insert: {
          error_message?: string | null
          flow_id: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          status?: string
          subject?: string
        }
        Update: {
          error_message?: string | null
          flow_id?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          subject: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      pipedrive_activities: {
        Row: {
          created_at: string
          deal_pipedrive_id: number | null
          done: boolean | null
          due_date: string | null
          due_time: string | null
          id: string
          note: string | null
          person_pipedrive_id: number | null
          pipedrive_id: number
          raw_data: Json | null
          subject: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_pipedrive_id?: number | null
          done?: boolean | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          note?: string | null
          person_pipedrive_id?: number | null
          pipedrive_id: number
          raw_data?: Json | null
          subject?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_pipedrive_id?: number | null
          done?: boolean | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          note?: string | null
          person_pipedrive_id?: number | null
          pipedrive_id?: number
          raw_data?: Json | null
          subject?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipedrive_deals: {
        Row: {
          close_time: string | null
          created_at: string
          currency: string | null
          id: string
          lost_reason: string | null
          lost_time: string | null
          org_name: string | null
          owner_email: string | null
          owner_name: string | null
          person_id: number | null
          person_name: string | null
          pipedrive_id: number
          pipeline_name: string | null
          raw_data: Json | null
          stage_name: string | null
          status: string | null
          team_member_id: string | null
          title: string
          updated_at: string
          value: number | null
          wa_conversation_id: string | null
          won_time: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          lost_reason?: string | null
          lost_time?: string | null
          org_name?: string | null
          owner_email?: string | null
          owner_name?: string | null
          person_id?: number | null
          person_name?: string | null
          pipedrive_id: number
          pipeline_name?: string | null
          raw_data?: Json | null
          stage_name?: string | null
          status?: string | null
          team_member_id?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          wa_conversation_id?: string | null
          won_time?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          lost_reason?: string | null
          lost_time?: string | null
          org_name?: string | null
          owner_email?: string | null
          owner_name?: string | null
          person_id?: number | null
          person_name?: string | null
          pipedrive_id?: number
          pipeline_name?: string | null
          raw_data?: Json | null
          stage_name?: string | null
          status?: string | null
          team_member_id?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          wa_conversation_id?: string | null
          won_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_deals_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipedrive_deals_wa_conversation_id_fkey"
            columns: ["wa_conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedrive_notes: {
        Row: {
          content: string | null
          created_at: string
          deal_pipedrive_id: number | null
          id: string
          person_pipedrive_id: number | null
          pipedrive_id: number
          raw_data: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          deal_pipedrive_id?: number | null
          id?: string
          person_pipedrive_id?: number | null
          pipedrive_id: number
          raw_data?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string
          deal_pipedrive_id?: number | null
          id?: string
          person_pipedrive_id?: number | null
          pipedrive_id?: number
          raw_data?: Json | null
        }
        Relationships: []
      }
      pipedrive_persons: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          org_name: string | null
          owner_name: string | null
          phone: string | null
          pipedrive_id: number
          raw_data: Json | null
          updated_at: string
          wa_contact_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_name?: string | null
          owner_name?: string | null
          phone?: string | null
          pipedrive_id: number
          raw_data?: Json | null
          updated_at?: string
          wa_contact_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_name?: string | null
          owner_name?: string | null
          phone?: string | null
          pipedrive_id?: number
          raw_data?: Json | null
          updated_at?: string
          wa_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_persons_wa_contact_id_fkey"
            columns: ["wa_contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedrive_sdr_queue: {
        Row: {
          attempts: number | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          deal_pipedrive_id: number
          error: string | null
          id: string
          instance_id: string
          instance_name: string
          person_name: string | null
          person_phone: string
          pipedrive_context: Json | null
          processed_at: string | null
          status: string
          team_member_id: string | null
        }
        Insert: {
          attempts?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deal_pipedrive_id: number
          error?: string | null
          id?: string
          instance_id: string
          instance_name: string
          person_name?: string | null
          person_phone: string
          pipedrive_context?: Json | null
          processed_at?: string | null
          status?: string
          team_member_id?: string | null
        }
        Update: {
          attempts?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deal_pipedrive_id?: number
          error?: string | null
          id?: string
          instance_id?: string
          instance_name?: string
          person_name?: string | null
          person_phone?: string
          pipedrive_context?: Json | null
          processed_at?: string | null
          status?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_sdr_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipedrive_sdr_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipedrive_sdr_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipedrive_sdr_queue_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedrive_webhook_logs: {
        Row: {
          created_at: string
          entity: string
          error: string | null
          event: string
          id: string
          payload: Json | null
          pipedrive_id: number | null
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          entity: string
          error?: string | null
          event: string
          id?: string
          payload?: Json | null
          pipedrive_id?: number | null
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          entity?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json | null
          pipedrive_id?: number | null
          processed?: boolean | null
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
          email: string | null
          id: string
          member_role: string
          name: string
          phone: string | null
          pipedrive_user_id: number | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_role?: string
          name: string
          phone?: string | null
          pipedrive_user_id?: number | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          member_role?: string
          name?: string
          phone?: string | null
          pipedrive_user_id?: number | null
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
          session_token: string | null
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
          session_token?: string | null
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
          session_token?: string | null
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
      wa_contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "wa_tags"
            referencedColumns: ["id"]
          },
        ]
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
      wa_conversation_state_events: {
        Row: {
          actor_team_member_id: string | null
          actor_type: Database["public"]["Enums"]["conversation_event_actor_type_enum"]
          actor_user_id: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          new_conversation_mode:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          new_lead_stage: Database["public"]["Enums"]["lead_stage_enum"] | null
          new_priority_level:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          previous_conversation_mode:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          previous_lead_stage:
            | Database["public"]["Enums"]["lead_stage_enum"]
            | null
          previous_priority_level:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          reason: string | null
          source: Database["public"]["Enums"]["conversation_event_source_enum"]
        }
        Insert: {
          actor_team_member_id?: string | null
          actor_type: Database["public"]["Enums"]["conversation_event_actor_type_enum"]
          actor_user_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          new_conversation_mode?:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          new_lead_stage?: Database["public"]["Enums"]["lead_stage_enum"] | null
          new_priority_level?:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          previous_conversation_mode?:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          previous_lead_stage?:
            | Database["public"]["Enums"]["lead_stage_enum"]
            | null
          previous_priority_level?:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          reason?: string | null
          source: Database["public"]["Enums"]["conversation_event_source_enum"]
        }
        Update: {
          actor_team_member_id?: string | null
          actor_type?: Database["public"]["Enums"]["conversation_event_actor_type_enum"]
          actor_user_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_conversation_mode?:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          new_lead_stage?: Database["public"]["Enums"]["lead_stage_enum"] | null
          new_priority_level?:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          previous_conversation_mode?:
            | Database["public"]["Enums"]["conversation_mode_enum"]
            | null
          previous_lead_stage?:
            | Database["public"]["Enums"]["lead_stage_enum"]
            | null
          previous_priority_level?:
            | Database["public"]["Enums"]["priority_level_enum"]
            | null
          reason?: string | null
          source?: Database["public"]["Enums"]["conversation_event_source_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversation_state_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          contact_id: string
          conversation_mode: Database["public"]["Enums"]["conversation_mode_enum"]
          created_at: string
          handoff_reason: string | null
          human_takeover_at: string | null
          human_takeover_by: string | null
          id: string
          instance_id: string
          last_ai_message_at: string | null
          last_human_message_at: string | null
          last_message: string | null
          last_message_at: string | null
          last_mode_changed_at: string | null
          last_mode_changed_by: string | null
          last_stage_changed_at: string | null
          last_stage_changed_by: string | null
          lead_stage: Database["public"]["Enums"]["lead_stage_enum"]
          lead_status: string
          priority_level: Database["public"]["Enums"]["priority_level_enum"]
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          contact_id: string
          conversation_mode?: Database["public"]["Enums"]["conversation_mode_enum"]
          created_at?: string
          handoff_reason?: string | null
          human_takeover_at?: string | null
          human_takeover_by?: string | null
          id?: string
          instance_id: string
          last_ai_message_at?: string | null
          last_human_message_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          last_mode_changed_at?: string | null
          last_mode_changed_by?: string | null
          last_stage_changed_at?: string | null
          last_stage_changed_by?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          lead_status?: string
          priority_level?: Database["public"]["Enums"]["priority_level_enum"]
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          contact_id?: string
          conversation_mode?: Database["public"]["Enums"]["conversation_mode_enum"]
          created_at?: string
          handoff_reason?: string | null
          human_takeover_at?: string | null
          human_takeover_by?: string | null
          id?: string
          instance_id?: string
          last_ai_message_at?: string | null
          last_human_message_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          last_mode_changed_at?: string | null
          last_mode_changed_by?: string | null
          last_stage_changed_at?: string | null
          last_stage_changed_by?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          lead_status?: string
          priority_level?: Database["public"]["Enums"]["priority_level_enum"]
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
      wa_follow_up_reminders: {
        Row: {
          completed: boolean
          completed_at: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          remind_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          remind_at: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          remind_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_follow_up_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_follow_up_reminders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_follow_up_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_instances: {
        Row: {
          ai_sdr_config: Json
          ai_sdr_enabled: boolean
          closer_id: string | null
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean
          phone: string | null
          sdr_id: string | null
          updated_at: string
        }
        Insert: {
          ai_sdr_config?: Json
          ai_sdr_enabled?: boolean
          closer_id?: string | null
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean
          phone?: string | null
          sdr_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_sdr_config?: Json
          ai_sdr_enabled?: boolean
          closer_id?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean
          phone?: string | null
          sdr_id?: string | null
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
          {
            foreignKeyName: "wa_instances_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_lead_scores: {
        Row: {
          contact_id: string
          created_at: string
          engagement_score: number
          id: string
          last_calculated_at: string
          response_speed_score: number
          risk_level: string
          score: number
          sentiment_score: number
        }
        Insert: {
          contact_id: string
          created_at?: string
          engagement_score?: number
          id?: string
          last_calculated_at?: string
          response_speed_score?: number
          risk_level?: string
          score?: number
          sentiment_score?: number
        }
        Update: {
          contact_id?: string
          created_at?: string
          engagement_score?: number
          id?: string
          last_calculated_at?: string
          response_speed_score?: number
          risk_level?: string
          score?: number
          sentiment_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "wa_lead_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "wa_contacts"
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
          media_mime_type: string | null
          media_type: string | null
          media_url: string | null
          provider_message_id: string | null
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
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          provider_message_id?: string | null
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
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          provider_message_id?: string | null
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
      wa_notes: {
        Row: {
          author_id: string
          contact_id: string
          content: string
          conversation_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          contact_id: string
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          contact_id?: string
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          is_stage: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_stage?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_stage?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      wa_transfer_logs: {
        Row: {
          conversation_id: string
          created_at: string
          from_member_id: string | null
          from_role: string | null
          id: string
          note: string | null
          to_member_id: string | null
          to_role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_member_id?: string | null
          from_role?: string | null
          id?: string
          note?: string | null
          to_member_id?: string | null
          to_role?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_member_id?: string | null
          from_role?: string | null
          id?: string
          note?: string | null
          to_member_id?: string | null
          to_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_transfer_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_transfer_logs_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_transfer_logs_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      claim_automation_actions: {
        Args: { batch_size?: number; worker_id?: string }
        Returns: {
          action_payload: Json
          action_type: string
          campaign_id: string
          contact_id: string
          created_at: string
          enrollment_id: string
          executed_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          retry_count: number
          scheduled_for: string
          status: string
          step_index: number
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_actions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_team_member_id: { Args: never; Returns: string }
      get_request_session_token: { Args: never; Returns: string }
      get_submission_by_id: {
        Args: { _submission_id: string }
        Returns: {
          ai_analysis: Json | null
          completed_at: string | null
          created_at: string
          id: string
          member_id: string | null
          respondent_email: string | null
          respondent_name: string | null
          respondent_phone: string | null
          session_token: string | null
          status: string
          test_link_id: string | null
          test_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "test_submissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_team_members_safe: {
        Args: never
        Returns: {
          active: boolean
          avatar_url: string
          created_at: string
          id: string
          member_role: string
          name: string
          pipedrive_user_id: number
        }[]
      }
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
      normalize_phone: { Args: { input: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "closer" | "sdr"
      conversation_event_actor_type_enum: "human" | "ai" | "system" | "admin"
      conversation_event_source_enum:
        | "ui"
        | "ai_sdr_agent"
        | "webhook"
        | "automation"
        | "migration"
        | "admin_action"
      conversation_mode_enum:
        | "ia_ativa"
        | "humano_assumiu"
        | "compartilhado"
        | "pausado"
      lead_stage_enum:
        | "novo"
        | "em_contato"
        | "qualificado"
        | "agendado"
        | "reuniao"
        | "proposta"
        | "ganho"
        | "perdido"
        | "pausado"
      priority_level_enum: "normal" | "atento" | "urgente"
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
      conversation_event_actor_type_enum: ["human", "ai", "system", "admin"],
      conversation_event_source_enum: [
        "ui",
        "ai_sdr_agent",
        "webhook",
        "automation",
        "migration",
        "admin_action",
      ],
      conversation_mode_enum: [
        "ia_ativa",
        "humano_assumiu",
        "compartilhado",
        "pausado",
      ],
      lead_stage_enum: [
        "novo",
        "em_contato",
        "qualificado",
        "agendado",
        "reuniao",
        "proposta",
        "ganho",
        "perdido",
        "pausado",
      ],
      priority_level_enum: ["normal", "atento", "urgente"],
    },
  },
} as const
