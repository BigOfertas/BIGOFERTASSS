export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_addresses: {
        Row: {
          city: string;
          complement: string | null;
          created_at: string;
          id: string;
          is_default: boolean;
          label: string;
          neighborhood: string;
          number: string;
          postal_code: string;
          recipient_name: string;
          state: string;
          street: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city: string;
          complement?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label: string;
          neighborhood: string;
          number: string;
          postal_code: string;
          recipient_name: string;
          state: string;
          street: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          complement?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          neighborhood?: string;
          number?: string;
          postal_code?: string;
          recipient_name?: string;
          state?: string;
          street?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          event_name: string;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          order_id: string | null;
          payload: Json;
          processed_at: string | null;
          user_id: string;
        };
        Insert: {
          event_name: string;
          id?: string;
          idempotency_key: string;
          occurred_at?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          user_id: string;
        };
        Update: {
          event_name?: string;
          id?: string;
          idempotency_key?: string;
          occurred_at?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          image_alt_text: string | null;
          image_storage_key: string | null;
          image_url: string | null;
          line_total: number;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_sku: string;
          product_slug: string | null;
          quantity: number;
          selected_options: Json;
          unit_price: number;
          variant_id: string | null;
          variant_name: string | null;
          variant_sku: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_alt_text?: string | null;
          image_storage_key?: string | null;
          image_url?: string | null;
          line_total: number;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_sku: string;
          product_slug?: string | null;
          quantity: number;
          selected_options?: Json;
          unit_price: number;
          variant_id?: string | null;
          variant_name?: string | null;
          variant_sku: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_alt_text?: string | null;
          image_storage_key?: string | null;
          image_url?: string | null;
          line_total?: number;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_sku?: string;
          product_slug?: string | null;
          quantity?: number;
          selected_options?: Json;
          unit_price?: number;
          variant_id?: string | null;
          variant_name?: string | null;
          variant_sku?: string;
        };
        Relationships: [];
      };
      order_timeline: {
        Row: {
          actor_type: Database["public"]["Enums"]["order_actor_type"];
          actor_user_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          message: string | null;
          order_id: string;
        };
        Insert: {
          actor_type: Database["public"]["Enums"]["order_actor_type"];
          actor_user_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          message?: string | null;
          order_id: string;
        };
        Update: {
          actor_type?: Database["public"]["Enums"]["order_actor_type"];
          actor_user_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          message?: string | null;
          order_id?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          address_city: string;
          address_complement: string | null;
          address_neighborhood: string;
          address_number: string;
          address_postal_code: string;
          address_recipient_name: string;
          address_state: string;
          address_street: string;
          canceled_at: string | null;
          created_at: string;
          currency: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          discount_amount: number;
          id: string;
          idempotency_key: string | null;
          paid_amount: number | null;
          paid_at: string | null;
          payment_method: string | null;
          payment_provider: string | null;
          payment_reference: string | null;
          payment_status: Database["public"]["Enums"]["order_payment_status"];
          production_business_days: number;
          production_started_at: string | null;
          public_number: string;
          refunded_at: string | null;
          shipped_at: string | null;
          shipping_additional_amount: number;
          shipping_amount: number;
          shipping_base_amount: number;
          shipping_provider: string | null;
          shipping_quote_reference: string | null;
          shipping_quoted_at: string | null;
          shipping_service: string | null;
          shipping_tracking_code: string | null;
          shipping_transit_business_days: number | null;
          source_address_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_amount: number;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_city: string;
          address_complement?: string | null;
          address_neighborhood: string;
          address_number: string;
          address_postal_code: string;
          address_recipient_name: string;
          address_state: string;
          address_street: string;
          canceled_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          delivered_at?: string | null;
          discount_amount?: number;
          id?: string;
          idempotency_key?: string | null;
          paid_amount?: number | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_provider?: string | null;
          payment_reference?: string | null;
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          production_business_days?: number;
          production_started_at?: string | null;
          public_number: string;
          refunded_at?: string | null;
          shipped_at?: string | null;
          shipping_additional_amount?: number;
          shipping_amount?: number;
          shipping_base_amount?: number;
          shipping_provider?: string | null;
          shipping_quote_reference?: string | null;
          shipping_quoted_at?: string | null;
          shipping_service?: string | null;
          shipping_tracking_code?: string | null;
          shipping_transit_business_days?: number | null;
          source_address_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount: number;
          total_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_city?: string;
          address_complement?: string | null;
          address_neighborhood?: string;
          address_number?: string;
          address_postal_code?: string;
          address_recipient_name?: string;
          address_state?: string;
          address_street?: string;
          canceled_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          discount_amount?: number;
          id?: string;
          idempotency_key?: string | null;
          paid_amount?: number | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_provider?: string | null;
          payment_reference?: string | null;
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          production_business_days?: number;
          production_started_at?: string | null;
          public_number?: string;
          refunded_at?: string | null;
          shipped_at?: string | null;
          shipping_additional_amount?: number;
          shipping_amount?: number;
          shipping_base_amount?: number;
          shipping_provider?: string | null;
          shipping_quote_reference?: string | null;
          shipping_quoted_at?: string | null;
          shipping_service?: string | null;
          shipping_tracking_code?: string | null;
          shipping_transit_business_days?: number | null;
          source_address_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          category_id: string;
          created_at: string;
          product_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          product_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          product_id?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          byte_size: number | null;
          card_storage_key: string | null;
          checksum_sha256: string | null;
          created_at: string;
          etag: string | null;
          height_px: number | null;
          id: string;
          is_primary: boolean;
          mime_type: string;
          original_filename: string | null;
          product_id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["product_image_status"];
          storage_key: string;
          thumb_storage_key: string | null;
          updated_at: string;
          variant_id: string | null;
          width_px: number | null;
        };
        Insert: {
          alt_text?: string | null;
          byte_size?: number | null;
          card_storage_key?: string | null;
          checksum_sha256?: string | null;
          created_at?: string;
          etag?: string | null;
          height_px?: number | null;
          id?: string;
          is_primary?: boolean;
          mime_type?: string;
          original_filename?: string | null;
          product_id: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_image_status"];
          storage_key: string;
          updated_at?: string;
          variant_id?: string | null;
          width_px?: number | null;
        };
        Update: {
          alt_text?: string | null;
          byte_size?: number | null;
          checksum_sha256?: string | null;
          created_at?: string;
          etag?: string | null;
          height_px?: number | null;
          id?: string;
          is_primary?: boolean;
          mime_type?: string;
          original_filename?: string | null;
          product_id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_image_status"];
          storage_key?: string;
          thumb_storage_key?: string | null;
          updated_at?: string;
          variant_id?: string | null;
          width_px?: number | null;
        };
        Relationships: [];
      };
      product_option_values: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          option_id: string;
          sort_order: number;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          option_id: string;
          sort_order?: number;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          option_id?: string;
          sort_order?: number;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      product_options: {
        Row: {
          created_at: string;
          id: string;
          is_required: boolean;
          kind: Database["public"]["Enums"]["product_option_kind"];
          name: string;
          product_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          kind?: Database["public"]["Enums"]["product_option_kind"];
          name: string;
          product_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          kind?: Database["public"]["Enums"]["product_option_kind"];
          name?: string;
          product_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variant_values: {
        Row: {
          created_at: string;
          option_id: string;
          option_value_id: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          option_id: string;
          option_value_id: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          option_id?: string;
          option_value_id?: string;
          variant_id?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          created_at: string;
          id: string;
          is_default: boolean;
          name: string | null;
          price_override: number | null;
          product_id: string;
          promotional_price_override: number | null;
          sku: string;
          sort_order: number;
          status: Database["public"]["Enums"]["product_variant_status"];
          stock_quantity: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string | null;
          price_override?: number | null;
          product_id: string;
          promotional_price_override?: number | null;
          sku: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_variant_status"];
          stock_quantity?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string | null;
          price_override?: number | null;
          product_id?: string;
          promotional_price_override?: number | null;
          sku?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_variant_status"];
          stock_quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          campeonato: string | null;
          campeonato_key: string;
          catalog_search_text: string;
          catalog_search_vector: unknown;
          category: string | null;
          created_at: string;
          description: string | null;
          height_cm: number | null;
          id: string;
          image_url: string | null;
          length_cm: number | null;
          liga: string | null;
          liga_key: string;
          name: string;
          price: number;
          primary_category_id: string | null;
          promotional_price: number | null;
          sku: string;
          slug: string;
          specifications: string | null;
          status: Database["public"]["Enums"]["product_status"];
          stock: number;
          time: string | null;
          time_key: string;
          updated_at: string;
          weight_grams: number | null;
          width_cm: number | null;
        };
        Insert: {
          campeonato?: string | null;
          campeonato_key?: string;
          catalog_search_text?: string;
          catalog_search_vector?: unknown;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          height_cm?: number | null;
          id?: string;
          image_url?: string | null;
          length_cm?: number | null;
          liga?: string | null;
          liga_key?: string;
          name: string;
          price: number;
          primary_category_id?: string | null;
          promotional_price?: number | null;
          sku: string;
          slug: string;
          specifications?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          stock?: number;
          time?: string | null;
          time_key?: string;
          updated_at?: string;
          weight_grams?: number | null;
          width_cm?: number | null;
        };
        Update: {
          campeonato?: string | null;
          campeonato_key?: string;
          catalog_search_text?: string;
          catalog_search_vector?: unknown;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          height_cm?: number | null;
          id?: string;
          image_url?: string | null;
          length_cm?: number | null;
          liga?: string | null;
          liga_key?: string;
          name?: string;
          price?: number;
          primary_category_id?: string | null;
          promotional_price?: number | null;
          sku?: string;
          slug?: string;
          specifications?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          stock?: number;
          time?: string | null;
          time_key?: string;
          updated_at?: string;
          weight_grams?: number | null;
          width_cm?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          cpf: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      refund_requests: {
        Row: {
          created_at: string;
          id: string;
          message: string | null;
          order_id: string;
          order_status_at_request: Database["public"]["Enums"]["order_status"];
          reason: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["refund_request_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message?: string | null;
          order_id: string;
          order_status_at_request: Database["public"]["Enums"]["order_status"];
          reason: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["refund_request_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string | null;
          order_id?: string;
          order_status_at_request?: Database["public"]["Enums"]["order_status"];
          reason?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["refund_request_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allocate_product_identity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          reservation_id: number;
          product_sku: string;
          product_slug: string;
          default_variant_sku: string;
        }[];
      };
      release_product_identity: {
        Args: { target_reservation_id: number };
        Returns: undefined;
      };
      get_product_purchase_config: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      admin_list_orders: {
        Args: {
          p_page?: number;
          p_page_size?: number;
          p_search?: string | null;
          p_sort?: string;
          p_status?: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          id: string;
          item_count: number;
          payment_status: string;
          public_number: string;
          refund_created_at: string | null;
          refund_reason: string | null;
          refund_request_id: string | null;
          refund_status: string | null;
          status: string;
          total_amount: number;
          total_count: number;
        }[];
      };
      catalog_filter_facets: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      catalog_filter_key: {
        Args: { value: string };
        Returns: string;
      };
      catalog_normalize_text: {
        Args: { value: string };
        Returns: string;
      };
      catalog_products_page: {
        Args: {
          p_query: string | null;
          p_category: string | null;
          p_campeonato: string | null;
          p_liga: string | null;
          p_time: string | null;
          p_min_price: number | null;
          p_max_price: number | null;
          p_sort: string;
          p_page: number;
          p_page_size: number;
        };
        Returns: Json;
      };
      create_order_core: {
        Args: {
          p_address_id: string;
          p_discount_amount?: number;
          p_idempotency_key?: string | null;
          p_items: Json;
          p_payment?: Json | null;
          p_shipping?: Json | null;
          p_user_id: string;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      delete_my_customer_address: {
        Args: { p_id: string };
        Returns: undefined;
      };
      get_my_customer_identity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          cpf: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
        }[];
      };
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      list_my_customer_addresses: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["customer_addresses"]["Row"][];
      };
      next_order_public_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      owner_resolve_refund_request: {
        Args: {
          p_note?: string | null;
          p_request_id: string;
          p_resolution: Database["public"]["Enums"]["refund_request_status"];
        };
        Returns: Database["public"]["Tables"]["refund_requests"]["Row"];
      };
      owner_transition_order: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"];
          p_note?: string | null;
          p_order_id: string;
          p_tracking_code?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      record_order_payment: {
        Args: {
          p_idempotency_key: string;
          p_method: string;
          p_order_id: string;
          p_paid_amount: number;
          p_provider: string;
          p_reference: string;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      refresh_product_stock: {
        Args: { target_product_id: string };
        Returns: undefined;
      };
      request_my_order_refund: {
        Args: {
          p_message?: string | null;
          p_order_id: string;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["refund_requests"]["Row"];
      };
      save_my_customer_address: {
        Args: {
          p_city: string;
          p_complement: string;
          p_id: string | null;
          p_is_default: boolean;
          p_label: string;
          p_neighborhood: string;
          p_number: string;
          p_postal_code: string;
          p_recipient_name: string;
          p_state: string;
          p_street: string;
        };
        Returns: string;
      };
      set_default_my_customer_address: {
        Args: { p_id: string };
        Returns: undefined;
      };
      set_primary_product_image: {
        Args: { target_image_id: string };
        Returns: undefined;
      };
      update_my_customer_identity: {
        Args: {
          p_cpf: string;
          p_full_name: string;
          p_phone: string;
        };
        Returns: {
          cpf: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
        }[];
      };
      validate_cart_items: {
        Args: { p_items: Json };
        Returns: Json;
      };
      slugify: {
        Args: { value: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: "customer" | "owner";
      order_actor_type: "system" | "customer" | "owner" | "integration";
      order_payment_status: "pending" | "paid" | "failed" | "canceled" | "refunded";
      order_status:
        | "pending_payment"
        | "paid"
        | "in_production"
        | "shipped"
        | "delivered"
        | "canceled"
        | "refunded";
      product_image_status: "pending" | "ready" | "failed" | "archived";
      product_option_kind: "size" | "style" | "color" | "other";
      product_status: "draft" | "active" | "inactive" | "archived";
      product_variant_status: "active" | "inactive" | "archived";
      refund_request_status: "requested" | "refunded" | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "owner"],
    },
  },
} as const;
