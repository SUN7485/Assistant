
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignments": {
                  Row: {
                    "created_at": string,"created_by": string,"group_id": string,"id": string,"questions": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"group_id": string,"id"?: string,"questions": number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"group_id"?: string,"id"?: string,"questions"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "day": string,"group_id": string,"recorded_at": string,"recorded_by": string,"status": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"group_id": string,"recorded_at"?: string,"recorded_by"?: string,"status": string,"student_id": string
                  }
                  Update: {
                    "day"?: string,"group_id"?: string,"recorded_at"?: string,"recorded_by"?: string,"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "group_id": string,"joined_at": string,"monthly_fee": number,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"joined_at"?: string,"monthly_fee"?: number,"student_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"monthly_fee"?: number,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"grades": {
                  Row: {
                    "correct": number,"graded_at": string,"graded_by": string,"note": string,"submission_id": string,"wrong": number
                  }
                  ComputedFields: never
                  Insert: {
                    "correct": number,"graded_at"?: string,"graded_by"?: string,"note"?: string,"submission_id": string,"wrong": number
                  }
                  Update: {
                    "correct"?: number,"graded_at"?: string,"graded_by"?: string,"note"?: string,"submission_id"?: string,"wrong"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "grades_graded_by_fkey"
      columns: ["graded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grades_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"schedule": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"schedule"?: string,"teacher_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"schedule"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"group_id": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string,"group_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"group_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notices_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"group_id": string,"month": string,"paid_at": string,"recorded_by": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"group_id": string,"month": string,"paid_at"?: string,"recorded_by"?: string,"student_id": string
                  }
                  Update: {
                    "amount"?: number,"group_id"?: string,"month"?: string,"paid_at"?: string,"recorded_by"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "can_add_students": boolean,"can_attendance": boolean,"can_grade": boolean,"can_see_payments": boolean,"created_at": string,"full_name": string,"id": string,"parent_phone": string | null,"phone": string,"role": string,"subject": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "can_add_students"?: boolean,"can_attendance"?: boolean,"can_grade"?: boolean,"can_see_payments"?: boolean,"created_at"?: string,"full_name": string,"id": string,"parent_phone"?: string | null,"phone": string,"role": string,"subject"?: string | null
                  }
                  Update: {
                    "can_add_students"?: boolean,"can_attendance"?: boolean,"can_grade"?: boolean,"can_see_payments"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"parent_phone"?: string | null,"phone"?: string,"role"?: string,"subject"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"submissions": {
                  Row: {
                    "assignment_id": string,"created_at": string,"id": string,"photo_paths": (string)[],"status": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"created_at"?: string,"id"?: string,"photo_paths": (string)[],"status"?: string,"student_id"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"created_at"?: string,"id"?: string,"photo_paths"?: (string)[],"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "in_group":
{ Args: { "g": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"own_pages":
{ Args: { "assignment": string,"paths": (string)[] }; Returns: boolean
                           },
"schema_version":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"teacher_can":
{ Args: { "perm": string }; Returns: boolean
                           },
"teaches_assignment":
{ Args: { "a": string }; Returns: boolean
                           },
"teaches_group":
{ Args: { "g": string }; Returns: boolean
                           },
"teaches_student":
{ Args: { "s": string }; Returns: boolean
                           },
"teaches_submission":
{ Args: { "sub": string }; Returns: boolean
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
            
          }
        }
} as const
