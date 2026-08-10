export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          comment: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          new_state: Json
          previous_state: Json
        }
        Insert: {
          action: string
          actor_id: string
          comment?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_state?: Json
          previous_state?: Json
        }
        Update: {
          action?: string
          actor_id?: string
          comment?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_state?: Json
          previous_state?: Json
        }
        Relationships: []
      }
      agency_verification_events: {
        Row: {
          actor_id: string | null
          agency_id: string
          created_at: string
          event_type: string
          id: string
          notes: string | null
        }
        Insert: {
          actor_id?: string | null
          agency_id: string
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
        }
        Update: {
          actor_id?: string | null
          agency_id?: string
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_verification_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_verification_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
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
      chat_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          hotel_id: string
          hotel_owner_id: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          organizer_id: string
          quote_id: string | null
          rfq_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          hotel_owner_id: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          organizer_id: string
          quote_id?: string | null
          rfq_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          hotel_owner_id?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          organizer_id?: string
          quote_id?: string | null
          rfq_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          buyer_organization_id: string
          created_at: string
          created_by: string | null
          id: string
          source_hotel_id: string | null
          source_invitation_id: string | null
          source_rfq_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          supplier_organization_id: string
          updated_at: string
        }
        Insert: {
          buyer_organization_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_hotel_id?: string | null
          source_invitation_id?: string | null
          source_rfq_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          supplier_organization_id: string
          updated_at?: string
        }
        Update: {
          buyer_organization_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_hotel_id?: string | null
          source_invitation_id?: string | null
          source_rfq_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          supplier_organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_buyer_organization_id_fkey"
            columns: ["buyer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_hotel_id_fkey"
            columns: ["source_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_hotel_id_fkey"
            columns: ["source_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_invitation_id_fkey"
            columns: ["source_invitation_id"]
            isOneToOne: true
            referencedRelation: "rfq_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_rfq_id_fkey"
            columns: ["source_rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_supplier_organization_id_fkey"
            columns: ["supplier_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_roles: {
        Row: {
          access_level: number
          created_at: string
          description: string
          id: string
          is_protected: boolean
          is_system: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          access_level?: number
          created_at?: string
          description?: string
          id?: string
          is_protected?: boolean
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          access_level?: number
          created_at?: string
          description?: string
          id?: string
          is_protected?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotel_amenities: {
        Row: {
          amenity_id: string
          created_at: string
          hotel_id: string
        }
        Insert: {
          amenity_id: string
          created_at?: string
          hotel_id: string
        }
        Update: {
          amenity_id?: string
          created_at?: string
          hotel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_amenities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_amenities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
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
          meal_plan_id: string | null
          room_type: string
          room_type_id: string | null
        }
        Insert: {
          base_price?: number
          capacity?: number
          count_available?: number
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          meal_plan_id?: string | null
          room_type: string
          room_type_id?: string | null
        }
        Update: {
          base_price?: number
          capacity?: number
          count_available?: number
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          meal_plan_id?: string | null
          room_type?: string
          room_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rooms_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotels: {
        Row: {
          address: string | null
          amenities: string[]
          archived: boolean
          city: string
          city_id: string | null
          country: string
          country_id: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          featured: boolean
          gallery: string[]
          hotel_type_id: string | null
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
          archived?: boolean
          city: string
          city_id?: string | null
          country: string
          country_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          hotel_type_id?: string | null
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
          archived?: boolean
          city?: string
          city_id?: string | null
          country?: string
          country_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          hotel_type_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "hotels_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_hotel_type_id_fkey"
            columns: ["hotel_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_types"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["offer_status"]
          supplier_organization_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          supplier_organization_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          supplier_organization_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_deal_supplier_fkey"
            columns: ["deal_id", "supplier_organization_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id", "supplier_organization_id"]
          },
        ]
      }
      organization_hotel_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          hotel_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hotel_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_hotel_mappings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_hotel_mappings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_hotel_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          membership_role: Database["public"]["Enums"]["organization_membership_role"]
          organization_id: string
          status: Database["public"]["Enums"]["organization_membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          invited_by?: string | null
          joined_at?: string | null
          membership_role: Database["public"]["Enums"]["organization_membership_role"]
          organization_id: string
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          membership_role?: Database["public"]["Enums"]["organization_membership_role"]
          organization_id?: string
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          legacy_owner_user_id: string | null
          legal_name: string | null
          organization_type: Database["public"]["Enums"]["organization_type"]
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id: string
          legacy_owner_user_id?: string | null
          legal_name?: string | null
          organization_type: Database["public"]["Enums"]["organization_type"]
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          legacy_owner_user_id?: string | null
          legal_name?: string | null
          organization_type?: Database["public"]["Enums"]["organization_type"]
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string
          key: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          key?: string
          name?: string
        }
        Relationships: []
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
          account_status: string
          agency_type: string | null
          agency_verification_status:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          annual_group_bookings: string | null
          api_available: string | null
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          avg_rooms_per_booking: string | null
          billing_address: string | null
          billing_email: string | null
          business_address: string | null
          city_id: string | null
          city_name: string | null
          company_name: string | null
          contact_email: string | null
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          contact_person_position: string | null
          contact_person_whatsapp: string | null
          country: string | null
          country_code: string | null
          country_id: string | null
          cr_document_path: string | null
          cr_expiry_date: string | null
          cr_number: string | null
          created_at: string
          employees_count: string | null
          full_address: string | null
          full_name: string | null
          hotel_approval_status:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id: string
          id_number: string | null
          id_type: Database["public"]["Enums"]["id_doc_type"] | null
          issuing_authority: string | null
          legal_agreements_accepted_at: string | null
          legal_billing_name: string | null
          legal_company_name: string | null
          locale: string
          org_name: string | null
          phone: string | null
          phone_number: string | null
          pms_enabled: boolean | null
          pms_provider: string | null
          pms_provider_other: string | null
          technical_contact_email: string | null
          technical_contact_name: string | null
          technical_contact_phone: string | null
          tourism_license_authority: string | null
          tourism_license_document_path: string | null
          tourism_license_number: string | null
          trade_name: string | null
          updated_at: string
          vat_billing_number: string | null
          vat_number: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_submitted_at: string | null
          verification_trust_level: string | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          account_status?: string
          agency_type?: string | null
          agency_verification_status?:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          annual_group_bookings?: string | null
          api_available?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avg_rooms_per_booking?: string | null
          billing_address?: string | null
          billing_email?: string | null
          business_address?: string | null
          city_id?: string | null
          city_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_person_position?: string | null
          contact_person_whatsapp?: string | null
          country?: string | null
          country_code?: string | null
          country_id?: string | null
          cr_document_path?: string | null
          cr_expiry_date?: string | null
          cr_number?: string | null
          created_at?: string
          employees_count?: string | null
          full_address?: string | null
          full_name?: string | null
          hotel_approval_status?:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_doc_type"] | null
          issuing_authority?: string | null
          legal_agreements_accepted_at?: string | null
          legal_billing_name?: string | null
          legal_company_name?: string | null
          locale?: string
          org_name?: string | null
          phone?: string | null
          phone_number?: string | null
          pms_enabled?: boolean | null
          pms_provider?: string | null
          pms_provider_other?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          tourism_license_authority?: string | null
          tourism_license_document_path?: string | null
          tourism_license_number?: string | null
          trade_name?: string | null
          updated_at?: string
          vat_billing_number?: string | null
          vat_number?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_submitted_at?: string | null
          verification_trust_level?: string | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          account_status?: string
          agency_type?: string | null
          agency_verification_status?:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          annual_group_bookings?: string | null
          api_available?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avg_rooms_per_booking?: string | null
          billing_address?: string | null
          billing_email?: string | null
          business_address?: string | null
          city_id?: string | null
          city_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_person_position?: string | null
          contact_person_whatsapp?: string | null
          country?: string | null
          country_code?: string | null
          country_id?: string | null
          cr_document_path?: string | null
          cr_expiry_date?: string | null
          cr_number?: string | null
          created_at?: string
          employees_count?: string | null
          full_address?: string | null
          full_name?: string | null
          hotel_approval_status?:
            | Database["public"]["Enums"]["hotel_approval_status"]
            | null
          id?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_doc_type"] | null
          issuing_authority?: string | null
          legal_agreements_accepted_at?: string | null
          legal_billing_name?: string | null
          legal_company_name?: string | null
          locale?: string
          org_name?: string | null
          phone?: string | null
          phone_number?: string | null
          pms_enabled?: boolean | null
          pms_provider?: string | null
          pms_provider_other?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          tourism_license_authority?: string | null
          tourism_license_document_path?: string | null
          tourism_license_number?: string | null
          trade_name?: string | null
          updated_at?: string
          vat_billing_number?: string | null
          vat_number?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_submitted_at?: string | null
          verification_trust_level?: string | null
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          board_included: Database["public"]["Enums"]["board_type"]
          created_at: string
          currency: string
          hotel_id: string
          id: string
          included_services: string[] | null
          inclusions: string | null
          notes: string | null
          price_per_room_night: number | null
          rfq_id: string
          room_type: string | null
          shortlisted_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_price: number
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          board_included?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          included_services?: string[] | null
          inclusions?: string | null
          notes?: string | null
          price_per_room_night?: number | null
          rfq_id: string
          room_type?: string | null
          shortlisted_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_price: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          board_included?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          included_services?: string[] | null
          inclusions?: string | null
          notes?: string | null
          price_per_room_night?: number | null
          rfq_id?: string
          room_type?: string | null
          shortlisted_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_price?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
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
            foreignKeyName: "quotes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
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
            foreignKeyName: "rfq_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
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
      rfq_lifecycle_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          invitation_id: string | null
          metadata: Json
          quote_id: string | null
          rfq_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          invitation_id?: string | null
          metadata?: Json
          quote_id?: string | null
          rfq_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          invitation_id?: string | null
          metadata?: Json
          quote_id?: string | null
          rfq_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_lifecycle_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "rfq_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_lifecycle_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_lifecycle_events_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          accommodation_type: string | null
          additional_requirements: string | null
          board_type: Database["public"]["Enums"]["board_type"]
          budget_max: number | null
          budget_min: number | null
          check_in: string
          check_out: string
          created_at: string
          currency: string
          deadline: string | null
          destination_city: string
          destination_city_id: string | null
          destination_country: string
          destination_country_id: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          guests_count: number
          hotel_categories: number[] | null
          hotel_categories_v2: string[] | null
          id: string
          meal_plan_code: string | null
          nights: number | null
          organizer_id: string
          requirements: string | null
          room_type_id: string | null
          room_type_pref: string | null
          rooms_needed: number
          special_requirements: string | null
          status: Database["public"]["Enums"]["rfq_status"]
          title: string
          updated_at: string
        }
        Insert: {
          accommodation_type?: string | null
          additional_requirements?: string | null
          board_type?: Database["public"]["Enums"]["board_type"]
          budget_max?: number | null
          budget_min?: number | null
          check_in: string
          check_out: string
          created_at?: string
          currency?: string
          deadline?: string | null
          destination_city: string
          destination_city_id?: string | null
          destination_country: string
          destination_country_id?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          guests_count?: number
          hotel_categories?: number[] | null
          hotel_categories_v2?: string[] | null
          id?: string
          meal_plan_code?: string | null
          nights?: number | null
          organizer_id: string
          requirements?: string | null
          room_type_id?: string | null
          room_type_pref?: string | null
          rooms_needed?: number
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          title: string
          updated_at?: string
        }
        Update: {
          accommodation_type?: string | null
          additional_requirements?: string | null
          board_type?: Database["public"]["Enums"]["board_type"]
          budget_max?: number | null
          budget_min?: number | null
          check_in?: string
          check_out?: string
          created_at?: string
          currency?: string
          deadline?: string | null
          destination_city?: string
          destination_city_id?: string | null
          destination_country?: string
          destination_country_id?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          guests_count?: number
          hotel_categories?: number[] | null
          hotel_categories_v2?: string[] | null
          id?: string
          meal_plan_code?: string | null
          nights?: number | null
          organizer_id?: string
          requirements?: string | null
          room_type_id?: string | null
          room_type_pref?: string | null
          rooms_needed?: number
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_interest: {
        Row: {
          approval_notes: string | null
          approval_reviewed_at: string | null
          approval_reviewed_by: string | null
          approval_status: string
          created_at: string
          email: string
          full_name: string
          hotel_id: string | null
          hotel_name: string | null
          id: string
          notified_at: string | null
          requested_plan: string
          status: string
          user_id: string | null
        }
        Insert: {
          approval_notes?: string | null
          approval_reviewed_at?: string | null
          approval_reviewed_by?: string | null
          approval_status?: string
          created_at?: string
          email: string
          full_name: string
          hotel_id?: string | null
          hotel_name?: string | null
          id?: string
          notified_at?: string | null
          requested_plan: string
          status?: string
          user_id?: string | null
        }
        Update: {
          approval_notes?: string | null
          approval_reviewed_at?: string | null
          approval_reviewed_by?: string | null
          approval_status?: string
          created_at?: string
          email?: string
          full_name?: string
          hotel_id?: string | null
          hotel_name?: string | null
          id?: string
          notified_at?: string | null
          requested_plan?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_interest_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_interest_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_enterprise_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_enterprise_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "enterprise_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          assigned_by: string | null
          created_at: string
          granted: boolean
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          granted: boolean
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          granted?: boolean
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
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
      agencies_public: {
        Row: {
          agency_type: string | null
          agency_verification_status:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          city_id: string | null
          country: string | null
          country_id: string | null
          id: string | null
          name: string | null
          verification_trust_level: string | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          agency_type?: string | null
          agency_verification_status?:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          city_id?: string | null
          country?: string | null
          country_id?: string | null
          id?: string | null
          name?: never
          verification_trust_level?: string | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          agency_type?: string | null
          agency_verification_status?:
            | Database["public"]["Enums"]["agency_verification_status"]
            | null
          city_id?: string | null
          country?: string | null
          country_id?: string | null
          id?: string | null
          name?: never
          verification_trust_level?: string | null
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels_public: {
        Row: {
          address: string | null
          amenities: string[] | null
          archived: boolean | null
          city: string | null
          city_id: string | null
          country: string | null
          country_id: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          gallery: string[] | null
          hotel_type_id: string | null
          id: string | null
          lat: number | null
          lng: number | null
          name: string | null
          slug: string | null
          star_rating: number | null
          status: Database["public"]["Enums"]["hotel_status"] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          archived?: boolean | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_id?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          gallery?: string[] | null
          hotel_type_id?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          slug?: string | null
          star_rating?: number | null
          status?: Database["public"]["Enums"]["hotel_status"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          archived?: boolean | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_id?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          gallery?: string[] | null
          hotel_type_id?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          slug?: string | null
          star_rating?: number | null
          status?: Database["public"]["Enums"]["hotel_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotels_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_hotel_type_id_fkey"
            columns: ["hotel_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_types"
            referencedColumns: ["id"]
          },
        ]
      }
      unmapped_locations: {
        Row: {
          city_text: string | null
          country_text: string | null
          destination_city: string | null
          destination_country: string | null
          label: string | null
          record_id: string | null
          record_type: string | null
          room_text: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _norm: { Args: { t: string }; Returns: string }
      accept_deal_offer: { Args: { _offer_id: string }; Returns: Json }
      admin_decide_approval: {
        Args: {
          _comment?: string
          _decision: string
          _source_id: string
          _source_type: string
        }
        Returns: Json
      }
      admin_get_user_auth_metadata: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      admin_set_role_permissions: {
        Args: { _permission_keys: string[]; _role_slug: string }
        Returns: undefined
      }
      admin_set_user_permissions: {
        Args: { _permission_keys: string[]; _target_user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { _role_slug: string; _target_user_id: string }
        Returns: undefined
      }
      award_quote: {
        Args: { _quote_id: string; _rfq_id: string }
        Returns: string
      }
      can_create_sourced_deal: {
        Args: {
          _buyer_organization_id: string
          _source_hotel_id: string
          _source_invitation_id: string
          _source_rfq_id: string
          _supplier_organization_id: string
        }
        Returns: boolean
      }
      can_manage_organization: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      can_view_hotel_photo: { Args: { _object_name: string }; Returns: boolean }
      can_view_hotel_through_rfq: {
        Args: { _hotel_id: string }
        Returns: boolean
      }
      cancel_deal: { Args: { _deal_id: string }; Returns: Json }
      close_deal: { Args: { _deal_id: string }; Returns: Json }
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      expire_deal_offer: { Args: { _offer_id: string }; Returns: Json }
      get_my_admin_access: { Args: never; Returns: Json }
      has_enterprise_role: {
        Args: { _role_slug: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_active: { Args: { _user_id: string }; Returns: boolean }
      is_active_organization_member: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      is_agency_rfq_eligible: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_enterprise_admin: { Args: { _user_id: string }; Returns: boolean }
      is_hotel_invited_to_rfq: {
        Args: { _rfq_id: string; _user_id: string }
        Returns: boolean
      }
      is_hotel_profile_approved: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_rfq_organizer: {
        Args: { _rfq_id: string; _user_id: string }
        Returns: boolean
      }
      legacy_organization_id: {
        Args: {
          _organization_type: Database["public"]["Enums"]["organization_type"]
          _user_id: string
        }
        Returns: string
      }
      legacy_organization_membership_id: {
        Args: { _organization_id: string; _user_id: string }
        Returns: string
      }
      organization_represents_legacy_owner: {
        Args: { _legacy_owner_user_id: string; _organization_id: string }
        Returns: boolean
      }
      provision_legacy_organization: {
        Args: {
          _organization_type: Database["public"]["Enums"]["organization_type"]
          _user_id: string
        }
        Returns: string
      }
      record_deal_offer_transition: {
        Args: {
          _entity_id: string
          _entity_type: string
          _from_status: string
          _metadata?: Json
          _to_status: string
        }
        Returns: undefined
      }
      reject_deal_offer: { Args: { _offer_id: string }; Returns: Json }
      user_organization_role: {
        Args: { _organization_id: string }
        Returns: Database["public"]["Enums"]["organization_membership_role"]
      }
      withdraw_deal_offer: { Args: { _offer_id: string }; Returns: Json }
    }
    Enums: {
      agency_verification_status:
        | "draft"
        | "submitted"
        | "pending_review"
        | "verified"
        | "rejected"
      app_role: "organizer" | "hotel" | "admin"
      board_type: "room_only" | "breakfast" | "half_board" | "full_board"
      booking_status: "confirmed" | "cancelled" | "completed"
      deal_status: "active" | "agreed" | "closed" | "cancelled"
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
      notification_type:
        | "rfq_new"
        | "rfq_invitation"
        | "quote_received"
        | "quote_accepted"
        | "quote_rejected"
        | "message_new"
        | "hotel_approved"
        | "hotel_rejected"
        | "company_approved"
        | "company_rejected"
        | "subscription_activated"
        | "subscription_expiring"
        | "rfq_awarded"
        | "rfq_closed"
      offer_status:
        | "submitted"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "expired"
      organization_membership_role:
        | "owner"
        | "admin"
        | "agent"
        | "sales"
        | "reservations"
        | "viewer"
      organization_membership_status:
        | "invited"
        | "active"
        | "suspended"
        | "removed"
      organization_status: "active" | "suspended" | "archived"
      organization_type: "agency" | "supplier" | "corporate_buyer"
      quote_status:
        | "submitted"
        | "shortlisted"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "viewed"
      rfq_status:
        | "draft"
        | "open"
        | "closed"
        | "awarded"
        | "cancelled"
        | "quoting"
        | "under_review"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agency_verification_status: [
        "draft",
        "submitted",
        "pending_review",
        "verified",
        "rejected",
      ],
      app_role: ["organizer", "hotel", "admin"],
      board_type: ["room_only", "breakfast", "half_board", "full_board"],
      booking_status: ["confirmed", "cancelled", "completed"],
      deal_status: ["active", "agreed", "closed", "cancelled"],
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
      notification_type: [
        "rfq_new",
        "rfq_invitation",
        "quote_received",
        "quote_accepted",
        "quote_rejected",
        "message_new",
        "hotel_approved",
        "hotel_rejected",
        "company_approved",
        "company_rejected",
        "subscription_activated",
        "subscription_expiring",
        "rfq_awarded",
        "rfq_closed",
      ],
      offer_status: [
        "submitted",
        "accepted",
        "rejected",
        "withdrawn",
        "expired",
      ],
      organization_membership_role: [
        "owner",
        "admin",
        "agent",
        "sales",
        "reservations",
        "viewer",
      ],
      organization_membership_status: [
        "invited",
        "active",
        "suspended",
        "removed",
      ],
      organization_status: ["active", "suspended", "archived"],
      organization_type: ["agency", "supplier", "corporate_buyer"],
      quote_status: [
        "submitted",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
        "viewed",
      ],
      rfq_status: [
        "draft",
        "open",
        "closed",
        "awarded",
        "cancelled",
        "quoting",
        "under_review",
      ],
    },
  },
} as const
