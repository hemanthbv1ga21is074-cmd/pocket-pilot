
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "budgets": {
                  Row: {
                    "category": Database["public"]['Enums']["category_key"],"id": string,"is_sample": boolean,"limit_minor": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["category_key"],"id"?: string,"is_sample"?: boolean,"limit_minor": number,"user_id"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["category_key"],"id"?: string,"is_sample"?: boolean,"limit_minor"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goal_contributions": {
                  Row: {
                    "amount_minor": number,"contributed_on": string,"created_at": string,"goal_id": string,"id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"contributed_on": string,"created_at"?: string,"goal_id": string,"id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"contributed_on"?: string,"created_at"?: string,"goal_id"?: string,"id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_contributions_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_sample": boolean,"name": string,"target_date": string | null,"target_minor": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_sample"?: boolean,"name": string,"target_date"?: string | null,"target_minor": number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_sample"?: boolean,"name"?: string,"target_date"?: string | null,"target_minor"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"currency": string,"display_name": string,"onboarded": boolean,"overall_monthly_budget_minor": number | null,"starting_balance_minor": number,"theme": string,"timezone": string,"user_id": string,"warn_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"display_name"?: string,"onboarded"?: boolean,"overall_monthly_budget_minor"?: number | null,"starting_balance_minor"?: number,"theme"?: string,"timezone"?: string,"user_id": string,"warn_pct"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"display_name"?: string,"onboarded"?: boolean,"overall_monthly_budget_minor"?: number | null,"starting_balance_minor"?: number,"theme"?: string,"timezone"?: string,"user_id"?: string,"warn_pct"?: number
                  }
                  Relationships: [
                    
                  ]
                },"recurring_payments": {
                  Row: {
                    "amount_minor": number,"anchor_day": number,"category": Database["public"]['Enums']["category_key"],"created_at": string,"due_date_before_last_payment": string | null,"frequency": Database["public"]['Enums']["payment_frequency"],"id": string,"is_paid": boolean,"is_sample": boolean,"last_paid_txn_id": string | null,"name": string,"next_due_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"anchor_day": number,"category": Database["public"]['Enums']["category_key"],"created_at"?: string,"due_date_before_last_payment"?: string | null,"frequency": Database["public"]['Enums']["payment_frequency"],"id"?: string,"is_paid"?: boolean,"is_sample"?: boolean,"last_paid_txn_id"?: string | null,"name": string,"next_due_date": string,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"anchor_day"?: number,"category"?: Database["public"]['Enums']["category_key"],"created_at"?: string,"due_date_before_last_payment"?: string | null,"frequency"?: Database["public"]['Enums']["payment_frequency"],"id"?: string,"is_paid"?: boolean,"is_sample"?: boolean,"last_paid_txn_id"?: string | null,"name"?: string,"next_due_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "amount_minor": number,"category": Database["public"]['Enums']["category_key"],"created_at": string,"description": string,"id": string,"is_reimbursed": boolean,"is_sample": boolean,"is_split": boolean,"notes": string | null,"payment_method": string,"recurring_payment_id": string | null,"reimbursable_minor": number,"split_with": string | null,"txn_date": string,"type": Database["public"]['Enums']["txn_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"category": Database["public"]['Enums']["category_key"],"created_at"?: string,"description": string,"id": string,"is_reimbursed"?: boolean,"is_sample"?: boolean,"is_split"?: boolean,"notes"?: string | null,"payment_method"?: string,"recurring_payment_id"?: string | null,"reimbursable_minor"?: number,"split_with"?: string | null,"txn_date": string,"type": Database["public"]['Enums']["txn_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: Database["public"]['Enums']["category_key"],"created_at"?: string,"description"?: string,"id"?: string,"is_reimbursed"?: boolean,"is_sample"?: boolean,"is_split"?: boolean,"notes"?: string | null,"payment_method"?: string,"recurring_payment_id"?: string | null,"reimbursable_minor"?: number,"split_with"?: string | null,"txn_date"?: string,"type"?: Database["public"]['Enums']["txn_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_recurring_payment_id_fkey"
      columns: ["recurring_payment_id"]
isOneToOne: false
      referencedRelation: "recurring_payments"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_goal_contribution":
{ Args: { "p_amount_minor": number,"p_goal_id": string,"p_note"?: string,"p_on_date"?: string }; Returns: {
              "amount_minor": number,
"contributed_on": string,
"created_at": string,
"goal_id": string,
"id": string,
"note": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "goal_contributions"
        isOneToOne: true
        isSetofReturn: false
      } },
"advance_due_date":
{ Args: { "p_anchor_day": number,"p_current_due": string,"p_frequency": Database["public"]['Enums']["payment_frequency"] }; Returns: string
                           },
"balance_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "net_goal_contributions_minor": number,"starting_balance_minor": number,"total_expense_minor": number,"total_income_minor": number
            }[]
                           },
"clear_sample_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"create_goal":
{ Args: { "p_contributed_on"?: string,"p_description"?: string,"p_name": string,"p_opening_contribution_minor"?: number,"p_target_date"?: string,"p_target_minor": number }; Returns: {
              "created_at": string,
"description": string | null,
"id": string,
"is_sample": boolean,
"name": string,
"target_date": string | null,
"target_minor": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "goals"
        isOneToOne: true
        isSetofReturn: false
      } },
"days_in_month":
{ Args: { "p_month": number,"p_year": number }; Returns: number
                           },
"mark_payment_paid":
{ Args: { "p_amount_minor"?: number,"p_paid_on"?: string,"p_payment_id": string }; Returns: {
              "amount_minor": number,
"anchor_day": number,
"category": Database["public"]['Enums']["category_key"],
"created_at": string,
"due_date_before_last_payment": string | null,
"frequency": Database["public"]['Enums']["payment_frequency"],
"id": string,
"is_paid": boolean,
"is_sample": boolean,
"last_paid_txn_id": string | null,
"name": string,
"next_due_date": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "recurring_payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"provision_auth_user":
{ Args: { "p_display_name"?: string,"p_email": string,"p_is_anonymous"?: boolean,"p_password": string }; Returns: string
                           },
"reset_all_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_sample_data":
{ Args: { "p_today"?: string }; Returns: undefined
                           },
"undo_last_payment":
{ Args: { "p_payment_id": string }; Returns: {
              "amount_minor": number,
"anchor_day": number,
"category": Database["public"]['Enums']["category_key"],
"created_at": string,
"due_date_before_last_payment": string | null,
"frequency": Database["public"]['Enums']["payment_frequency"],
"id": string,
"is_paid": boolean,
"is_sample": boolean,
"last_paid_txn_id": string | null,
"name": string,
"next_due_date": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "recurring_payments"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "category_key": "food_dining"|"transport"|"shopping"|"bills_utilities"|"housing_rent"|"entertainment"|"healthcare"|"education"|"subscriptions"|"other_expense"|"salary"|"freelance"|"gift"|"refund"|"other_income","payment_frequency": "once"|"weekly"|"monthly"|"quarterly"|"yearly","txn_type": "income"|"expense"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "category_key": ["food_dining", "transport", "shopping", "bills_utilities", "housing_rent", "entertainment", "healthcare", "education", "subscriptions", "other_expense", "salary", "freelance", "gift", "refund", "other_income"],"payment_frequency": ["once", "weekly", "monthly", "quarterly", "yearly"],"txn_type": ["income", "expense"]
          }
        }
} as const
