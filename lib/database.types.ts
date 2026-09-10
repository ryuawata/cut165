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
      body_measurements: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          lean_mass_lbs: number | null
          log_date: string
          measured_at: string | null
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
          weight_lbs: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          lean_mass_lbs?: number | null
          log_date: string
          measured_at?: string | null
          source: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
          weight_lbs: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          lean_mass_lbs?: number | null
          log_date?: string
          measured_at?: string | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
          weight_lbs?: number
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          alcohol_drinks: number
          calories: number | null
          carbs_g: number | null
          cardio_minutes: number
          created_at: string
          id: number
          log_date: string
          notes: string | null
          protein_g: number | null
          steps: number | null
          strength: boolean
          updated_at: string
          user_id: string | null
          water_oz: number | null
          weight_lbs: number | null
        }
        Insert: {
          alcohol_drinks?: number
          calories?: number | null
          carbs_g?: number | null
          cardio_minutes?: number
          created_at?: string
          id?: number
          log_date: string
          notes?: string | null
          protein_g?: number | null
          steps?: number | null
          strength?: boolean
          updated_at?: string
          user_id?: string | null
          water_oz?: number | null
          weight_lbs?: number | null
        }
        Update: {
          alcohol_drinks?: number
          calories?: number | null
          carbs_g?: number | null
          cardio_minutes?: number
          created_at?: string
          id?: number
          log_date?: string
          notes?: string | null
          protein_g?: number | null
          steps?: number | null
          strength?: boolean
          updated_at?: string
          user_id?: string | null
          water_oz?: number | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          cardio_minutes: number | null
          created_at: string
          id: string
          log_date: string
          notes: string | null
          steps: number | null
          updated_at: string
          user_id: string
          water_oz: number | null
        }
        Insert: {
          cardio_minutes?: number | null
          created_at?: string
          id?: string
          log_date: string
          notes?: string | null
          steps?: number | null
          updated_at?: string
          user_id: string
          water_oz?: number | null
        }
        Update: {
          cardio_minutes?: number | null
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          water_oz?: number | null
        }
        Relationships: []
      }
      fitness_goals: {
        Row: {
          calorie_max: number
          calorie_min: number
          goal_weight_lbs: number
          protein_min_g: number
          protein_target_g: number
          step_target: number
          target_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calorie_max?: number
          calorie_min?: number
          goal_weight_lbs?: number
          protein_min_g?: number
          protein_target_g?: number
          step_target?: number
          target_date?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          calorie_max?: number
          calorie_min?: number
          goal_weight_lbs?: number
          protein_min_g?: number
          protein_target_g?: number
          step_target?: number
          target_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          calories: number | null
          created_at: string
          description: string
          id: number
          log_date: string
          meal: string
          protein_g: number | null
          user_id: string | null
        }
        Insert: {
          calories?: number | null
          created_at?: string
          description: string
          id?: number
          log_date: string
          meal: string
          protein_g?: number | null
          user_id?: string | null
        }
        Update: {
          calories?: number | null
          created_at?: string
          description?: string
          id?: number
          log_date?: string
          meal?: string
          protein_g?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      goal_targets: {
        Row: {
          calorie_target_max: number
          calorie_target_min: number
          carb_target_g: number | null
          created_at: string
          effective_from: string
          effective_to: string | null
          goal_id: string
          id: string
          protein_target_g: number
          source: string
          steps_target: number
          user_id: string
          water_target_oz: number
          weekly_weight_change_target_lbs: number | null
        }
        Insert: {
          calorie_target_max: number
          calorie_target_min: number
          carb_target_g?: number | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          goal_id: string
          id?: string
          protein_target_g: number
          source: string
          steps_target: number
          user_id: string
          water_target_oz: number
          weekly_weight_change_target_lbs?: number | null
        }
        Update: {
          calorie_target_max?: number
          calorie_target_min?: number
          carb_target_g?: number | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          goal_id?: string
          id?: string
          protein_target_g?: number
          source?: string
          steps_target?: number
          user_id?: string
          water_target_oz?: number
          weekly_weight_change_target_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_targets_goal_owner_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          goal_type: string
          id: string
          start_date: string
          start_weight_lbs: number
          status: string
          target_date: string | null
          target_weight_lbs: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          goal_type: string
          id?: string
          start_date: string
          start_weight_lbs: number
          status?: string
          target_date?: string | null
          target_weight_lbs: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          goal_type?: string
          id?: string
          start_date?: string
          start_weight_lbs?: number
          status?: string
          target_date?: string | null
          target_weight_lbs?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_entries: {
        Row: {
          alcohol_servings: number | null
          calories: number | null
          carbs_g: number | null
          consumed_at: string | null
          created_at: string
          description: string
          entry_type: string
          fat_g: number | null
          id: string
          log_date: string
          meal_slot: string | null
          protein_g: number | null
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alcohol_servings?: number | null
          calories?: number | null
          carbs_g?: number | null
          consumed_at?: string | null
          created_at?: string
          description: string
          entry_type: string
          fat_g?: number | null
          id?: string
          log_date: string
          meal_slot?: string | null
          protein_g?: number | null
          source: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alcohol_servings?: number | null
          calories?: number | null
          carbs_g?: number | null
          consumed_at?: string | null
          created_at?: string
          description?: string
          entry_type?: string
          fat_g?: number | null
          id?: string
          log_date?: string
          meal_slot?: string | null
          protein_g?: number | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          display_name: string | null
          energy_estimation_sex: string | null
          height_inches: number | null
          onboarding_complete: boolean
          timezone: string
          updated_at: string
          user_id: string
          weight_unit: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          energy_estimation_sex?: string | null
          height_inches?: number | null
          onboarding_complete?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          weight_unit?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          energy_estimation_sex?: string | null
          height_inches?: number | null
          onboarding_complete?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          weight_unit?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          scheduled_date: string
          source: string
          source_ref: string | null
          status: string
          updated_at: string
          user_id: string
          workout_code: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          scheduled_date: string
          source: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workout_code: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workout_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_nutrition_totals: {
        Row: {
          alcohol_servings: number | null
          alcohol_unknown_count: number | null
          calories: number | null
          calories_unknown_count: number | null
          carbs_g: number | null
          carbs_unknown_count: number | null
          entry_count: number | null
          fat_g: number | null
          fat_unknown_count: number | null
          log_date: string | null
          protein_g: number | null
          protein_unknown_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
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
