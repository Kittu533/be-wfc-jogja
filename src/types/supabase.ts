export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SupabaseDatabase = {
  public: {
    Tables: {
      admin_places: {
        Row: {
          id: string;
          slug: string;
          name: string;
          area: string;
          category: string;
          status: string;
          image_status: string;
          updated_at: string;
          payload: Json;
        };
        Insert: {
          id: string;
          slug: string;
          name: string;
          area?: string;
          category?: string;
          status?: string;
          image_status?: string;
          updated_at?: string;
          payload: Json;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          area?: string;
          category?: string;
          status?: string;
          image_status?: string;
          updated_at?: string;
          payload?: Json;
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
