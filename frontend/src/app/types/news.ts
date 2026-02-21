export interface NewsCategory {
  id: string;
  name: string;
  name_kz?: string;
  name_en?: string;
  description?: string;
  order: number;
  is_active: boolean;
}

export interface News {
  id: string;
  title: string;
  title_kz?: string;
  title_en?: string;
  excerpt?: string;
  excerpt_kz?: string;
  excerpt_en?: string;
  content?: string;
  content_kz?: string;
  content_en?: string;
  category?: NewsCategory;
  category_id?: number;
  image?: string;
  image_url?: string;
  is_published: boolean;
  published_at?: string | null;
  order: number;
  created_at?: string;
  updated_at?: string;
}

export interface NewsDetail extends News {
  content: string;
  content_kz?: string;
  content_en?: string;
}
