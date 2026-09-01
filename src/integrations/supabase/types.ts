export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          checksum_sha256: string | null
          created_at: string
          etag: string | null
          height_px: number | null
          id: string
          is_primary: boolean
          mime_type: string
          original_filename: string | null
          product_id: string
          sort_order: number
          status: Database["public"]["Enums"]["product_image_status"]
          storage_key: string
          updated_at: string
          variant_id: string | null
          width_px: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          checksum_sha256?: string | null
          created_at?: string
          etag?: string | null
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string
          original_filename?: string | null
          product_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_image_status"]
          storage_key: string
          updated_at?: string
          variant_id?: string | null
          width_px?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          checksum_sha256?: string | null
          created_at?: string
          etag?: string | null
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string
          original_filename?: string | null
          product_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_image_status"]
          storage_key?: string
          updated_at?: string
          variant_id?: string | null
          width_px?: number | null
        }
        Relationships: []
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          option_id: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_id: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_id?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          kind: Database["public"]["Enums"]["product_option_kind"]
          name: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          kind?: Database["public"]["Enums"]["product_option_kind"]
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          kind?: Database["public"]["Enums"]["product_option_kind"]
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_variant_values: {
        Row: {
          created_at: string
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          option_value_id?: string
          variant_id?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string | null
          price_override: number | null
          product_id: string
          promotional_price_override: number | null
          sku: string
          sort_order: number
          status: Database["public"]["Enums"]["product_variant_status"]
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
          price_override?: number | null
          product_id: string
          promotional_price_override?: number | null
          sku: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_variant_status"]
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
          price_override?: number | null
          product_id?: string
          promotional_price_override?: number | null
          sku?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_variant_status"]
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          campeonato: string | null
          campeonato_key: string
          catalog_search_text: string
          catalog_search_vector: unknown
          category: string | null
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          length_cm: number | null
          liga: string | null
          liga_key: string
          name: string
          price: number
          primary_category_id: string | null
          promotional_price: number | null
          sku: string
          slug: string
          specifications: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          time: string | null
          time_key: string
          updated_at: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          campeonato?: string | null
          campeonato_key?: string
          catalog_search_text?: string
          catalog_search_vector?: unknown
          category?: string | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          liga?: string | null
          liga_key?: string
          name: string
          price: number
          primary_category_id?: string | null
          promotional_price?: number | null
          sku: string
          slug: string
          specifications?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          time?: string | null
          time_key?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          campeonato?: string | null
          campeonato_key?: string
          catalog_search_text?: string
          catalog_search_vector?: unknown
          category?: string | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          liga?: string | null
          liga_key?: string
          name?: string
          price?: number
          primary_category_id?: string | null
          promotional_price?: number | null
          sku?: string
          slug?: string
          specifications?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          time?: string | null
          time_key?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      catalog_filter_facets: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      catalog_filter_key: {
        Args: { value: string }
        Returns: string
      }
      catalog_normalize_text: {
        Args: { value: string }
        Returns: string
      }
      catalog_products_page: {
        Args: {
          p_query: string | null
          p_category: string | null
          p_campeonato: string | null
          p_liga: string | null
          p_time: string | null
          p_min_price: number | null
          p_max_price: number | null
          p_sort: string
          p_page: number
          p_page_size: number
        }
        Returns: Json
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      refresh_product_stock: {
        Args: { target_product_id: string }
        Returns: undefined
      }
      set_primary_product_image: {
        Args: { target_image_id: string }
        Returns: undefined
      }
      validate_cart_items: {
        Args: { p_items: Json }
        Returns: Json
      }
      slugify: {
        Args: { value: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "customer" | "owner"
      product_image_status: "pending" | "ready" | "failed" | "archived"
      product_option_kind: "size" | "style" | "color" | "other"
      product_status: "draft" | "active" | "inactive" | "archived"
      product_variant_status: "active" | "inactive" | "archived"
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
      app_role: ["customer", "owner"],
    },
  },
} as const
