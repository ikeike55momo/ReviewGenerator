import dotenv from 'dotenv';
dotenv.config();

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    apiKey: process.env.SUPABASE_ANON_KEY || '',
  },
  app: {
    name: 'CSV Review Generator',
    version: '1.0.0',
  },
};