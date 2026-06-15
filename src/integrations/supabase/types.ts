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
      bookings: {
        Row: {
          commission_amount: number
          contract_url: string | null
          created_at: string
          hotel_id: string
          id: string
          organizer_id: string
          quote_id: string
          rfq_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          contract_url?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          organizer_id: string
          quote_id: string
          rfq_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          contract_url?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          organizer_id?: string
          quote_id?: string
          rfq_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms: {
        Row: {
          base_price: number
          capacity: number
          count_available: number
          created_at: string
          currency: string
          hotel_id: string
          id: string
          room_type: string
        }
        Insert: {
          base_price?: number
          capacity?: number
          count_available?: number
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          room_type: string
        }
        Update: {
          base_price?: number
          capacity?: number
          count_available?: number
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          room_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          amenities: string[]
          city: string
          country: string
          cover_image: string | null
          created_at: string
          description: string | null
          featured: boolean
          gallery: string[]
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_id: string | null
          slug: string
          star_rating: number | null
          status: Database["public"]["Enums"]["hotel_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          city: string
          country: string
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_id?: string | null
          slug: string
          star_rating?: number | null
          status?: Database["public"]["Enums"]["hotel_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[]
          city?: string
          country?: string
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string | null
          slug?: string
          star_rating?: number | null
          status?: Database["public"]["Enums"]["hotel_status"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          rfq_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          rfq_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          rfq_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_name: string | null
          contact_email: string | null
          country: string | null
          cr_number: string | null
          created_at: string
          full_name: string | null
          hotel_approval_status:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id: string
          id_number: string | null
          id_type: Database["public"]["Enums"]["id_doc_type"] | null
          locale: string
          org_name: string | null
          phone: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          full_name?: string | null
          hotel_approval_status?:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_doc_type"] | null
          locale?: string
          org_name?: string | null
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          full_name?: string | null
          hotel_approval_status?:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_doc_type"] | null
          locale?: string
          org_name?: string | null
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          board_included: Database["public"]["Enums"]["board_type"]
          created_at: string
          currency: string
          hotel_id: string
          id: string
          inclusions: string | null
          notes: string | null
          price_per_room_night: number | null
          rfq_id: string
          status: Database["public"]["Enums"]["quote_status"]
          total_price: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          board_included?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          inclusions?: string | null
          notes?: string | null
          price_per_room_night?: number | null
          rfq_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_price: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          board_included?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          inclusions?: string | null
          notes?: string | null
          price_per_room_night?: number | null
          rfq_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_price?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_invitations: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          rfq_id: string
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          rfq_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          rfq_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rfq_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_invitations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          board_type: Database["public"]["Enums"]["board_type"]
          budget_max: number | null
          budget_min: number | null
          check_in: string
          check_out: string
          created_at: string
          currency: string
          deadline: string | null
          destination_city: string
          destination_country: string
          group_type: Database["public"]["Enums"]["group_type"]
          guests_count: number
          id: string
          nights: number | null
          organizer_id: string
          room_type_pref: string | null
          rooms_needed: number
          special_requirements: string | null
          status: Database["public"]["Enums"]["rfq_status"]
          title: string
          updated_at: string
        }
        Insert: {
          board_type?: Database["public"]["Enums"]["board_type"]
          budget_max?: number | null
          budget_min?: number | null
          check_in: string
          check_out: string
          created_at?: string
          currency?: string
          deadline?: string | null
          destination_city: string
          destination_country: string
          group_type?: Database["public"]["Enums"]["group_type"]
          guests_count?: number
          id?: string
          nights?: number | null
          organizer_id: string
          room_type_pref?: string | null
          rooms_needed?: number
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          title: string
          updated_at?: string
        }
        Update: {
          board_type?: Database["public"]["Enums"]["board_type"]
          budget_max?: number | null
          budget_min?: number | null
          check_in?: string
          check_out?: string
          created_at?: string
          currency?: string
          deadline?: string | null
          destination_city?: string
          destination_country?: string
          group_type?: Database["public"]["Enums"]["group_type"]
          guests_count?: number
          id?: string
          nights?: number | null
          organizer_id?: string
          room_type_pref?: string | null
          rooms_needed?: number
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hotel_profile_approved: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "organizer" | "hotel" | "admin"
      board_type: "room_only" | "breakfast" | "half_board" | "full_board"
      booking_status: "confirmed" | "cancelled" | "completed"
      group_type:
        | "umrah"
        | "hajj"
        | "tourism"
        | "corporate"
        | "government"
        | "sports"
        | "education"
        | "event"
        | "other"
      hotel_approval_status: "pending" | "approved" | "rejected"
      hotel_status: "pending" | "approved" | "suspended"
      id_doc_type: "saudi_id" | "iqama"
      invitation_status: "pending" | "viewed" | "quoted" | "declined"
      quote_status:
        | "submitted"
        | "shortlisted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      rfq_status: "draft" | "open" | "closed" | "awarded" | "cancelled"
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
      app_role: ["organizer", "hotel", "admin"],
      board_type: ["room_only", "breakfast", "half_board", "full_board"],
      booking_status: ["confirmed", "cancelled", "completed"],
      group_type: [
        "umrah",
        "hajj",
        "tourism",
        "corporate",
        "government",
        "sports",
        "education",
        "event",
        "other",
      ],
      hotel_approval_status: ["pending", "approved", "rejected"],
      hotel_status: ["pending", "approved", "suspended"],
      id_doc_type: ["saudi_id", "iqama"],
      invitation_status: ["pending", "viewed", "quoted", "declined"],
      quote_status: [
        "submitted",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      rfq_status: ["draft", "open", "closed", "awarded", "cancelled"],
    },
  },
} as const
