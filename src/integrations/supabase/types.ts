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
          agency_type: string | null
          api_available: string | null
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          business_address: string | null
          company_name: string | null
          contact_email: string | null
          country: string | null
          country_code: string | null
          country_id: string | null
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
          phone_number: string | null
          pms_enabled: boolean | null
          pms_provider: string | null
          pms_provider_other: string | null
          technical_contact_email: string | null
          technical_contact_name: string | null
          technical_contact_phone: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          agency_type?: string | null
          api_available?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_address?: string | null
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          country_code?: string | null
          country_id?: string | null
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
          phone_number?: string | null
          pms_enabled?: boolean | null
          pms_provider?: string | null
          pms_provider_other?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          agency_type?: string | null
          api_available?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_address?: string | null
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          country_code?: string | null
          country_id?: string | null
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
          phone_number?: string | null
          pms_enabled?: boolean | null
          pms_provider?: string | null
          pms_provider_other?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
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
          id: string
          meal_plan_code: string | null
          nights: number | null
          organizer_id: string
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
          id?: string
          meal_plan_code?: string | null
          nights?: number | null
          organizer_id: string
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
          id?: string
          meal_plan_code?: string | null
          nights?: number | null
          organizer_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
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
