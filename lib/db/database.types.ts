// This file is auto-generated from Supabase schema
// To regenerate: npx supabase gen types typescript --project-id your-project-id > lib/db/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          credits: number;
          subscription_tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          credits?: number;
          subscription_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          credits?: number;
          subscription_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scripts: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          format: string;
          script_text: string | null;
          script_json: Json | null;
          duration_seconds: number | null;
          ai_model: string;
          trending_angle: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          format: string;
          script_text?: string | null;
          script_json?: Json | null;
          duration_seconds?: number | null;
          ai_model?: string;
          trending_angle?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string;
          format?: string;
          script_text?: string | null;
          script_json?: Json | null;
          duration_seconds?: number | null;
          ai_model?: string;
          trending_angle?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scripts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          script_id: string;
          status: string;
          video_url: string | null;
          format: string | null;
          duration_seconds: number | null;
          resolution: string;
          file_size_mb: number | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          uploaded_to_youtube: boolean;
          youtube_url: string | null;
          youtube_video_id: string | null;
          youtube_upload_status: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          script_id: string;
          status?: string;
          video_url?: string | null;
          format?: string | null;
          duration_seconds?: number | null;
          resolution?: string;
          file_size_mb?: number | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          uploaded_to_youtube?: boolean;
          youtube_url?: string | null;
          youtube_video_id?: string | null;
          youtube_upload_status?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          script_id?: string;
          status?: string;
          video_url?: string | null;
          format?: string | null;
          duration_seconds?: number | null;
          resolution?: string;
          file_size_mb?: number | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          uploaded_to_youtube?: boolean;
          youtube_url?: string | null;
          youtube_video_id?: string | null;
          youtube_upload_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'videos_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'scripts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'videos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      voiceovers: {
        Row: {
          id: string;
          user_id: string;
          script_id: string;
          video_id: string | null;
          audio_url: string;
          voice_provider: string;
          voice_id: string | null;
          duration_seconds: number | null;
          cost_usd: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          script_id: string;
          video_id?: string | null;
          audio_url: string;
          voice_provider: string;
          voice_id?: string | null;
          duration_seconds?: number | null;
          cost_usd?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          script_id?: string;
          video_id?: string | null;
          audio_url?: string;
          voice_provider?: string;
          voice_id?: string | null;
          duration_seconds?: number | null;
          cost_usd?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'voiceovers_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'scripts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'voiceovers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'voiceovers_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          }
        ];
      };
      clips: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          source: string;
          source_id: string | null;
          source_url: string | null;
          title: string | null;
          duration_seconds: number | null;
          position_in_video: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          source: string;
          source_id?: string | null;
          source_url?: string | null;
          title?: string | null;
          duration_seconds?: number | null;
          position_in_video?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          video_id?: string;
          source?: string;
          source_id?: string | null;
          source_url?: string | null;
          title?: string | null;
          duration_seconds?: number | null;
          position_in_video?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clips_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clips_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          }
        ];
      };
      trending_topics: {
        Row: {
          id: string;
          platform: string;
          topic: string;
          category: string | null;
          search_volume: number | null;
          growth_percentage: number | null;
          competition_level: string | null;
          suggested_format: string | null;
          fetched_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          topic: string;
          category?: string | null;
          search_volume?: number | null;
          growth_percentage?: number | null;
          competition_level?: string | null;
          suggested_format?: string | null;
          fetched_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          topic?: string;
          category?: string | null;
          search_volume?: number | null;
          growth_percentage?: number | null;
          competition_level?: string | null;
          suggested_format?: string | null;
          fetched_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      user_usage: {
        Row: {
          id: string;
          user_id: string;
          scripts_generated: number;
          videos_generated: number;
          voiceover_minutes_used: number;
          total_spent_usd: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scripts_generated?: number;
          videos_generated?: number;
          voiceover_minutes_used?: number;
          total_spent_usd?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scripts_generated?: number;
          videos_generated?: number;
          voiceover_minutes_used?: number;
          total_spent_usd?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      video_pricing: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          script_cost_usd: number | null;
          voiceover_cost_usd: number | null;
          assembly_cost_usd: number | null;
          total_base_cost_usd: number | null;
          markup_percentage: number | null;
          final_price_usd: number | null;
          payment_status: string;
          stripe_payment_intent_id: string | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          script_cost_usd?: number | null;
          voiceover_cost_usd?: number | null;
          assembly_cost_usd?: number | null;
          total_base_cost_usd?: number | null;
          markup_percentage?: number | null;
          final_price_usd?: number | null;
          payment_status?: string;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          video_id?: string;
          script_cost_usd?: number | null;
          voiceover_cost_usd?: number | null;
          assembly_cost_usd?: number | null;
          total_base_cost_usd?: number | null;
          markup_percentage?: number | null;
          final_price_usd?: number | null;
          payment_status?: string;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'video_pricing_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'video_pricing_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          endpoint: string;
          method: string;
          status_code: number | null;
          response_time_ms: number | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          endpoint: string;
          method: string;
          status_code?: number | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          endpoint?: string;
          method?: string;
          status_code?: number | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
