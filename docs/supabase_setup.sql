-- Supabase Setup Script for MiniQR File Sharing

-- 1. Create the qr_files_log table in public schema
CREATE TABLE IF NOT EXISTS public.qr_files_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    files_list TEXT[] NOT NULL
);

-- 2. Enable Row Level Security (RLS) on the table
ALTER TABLE public.qr_files_log ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for public access (since the client uses the anon key)
-- Allow anyone (anonymous public users) to insert new file logs when generating a QR Code
CREATE POLICY "Allow public insert" ON public.qr_files_log
    FOR INSERT TO anon
    WITH CHECK (true);

-- Allow anyone to select logs to display files on the share/download page
CREATE POLICY "Allow public select" ON public.qr_files_log
    FOR SELECT TO anon
    USING (true);

-- Allow anyone to delete logs (used when admin deletes log records)
CREATE POLICY "Allow public delete" ON public.qr_files_log
    FOR DELETE TO anon
    USING (true);

-- Allow anyone to update logs (used when admin edits/renames zip file names)
CREATE POLICY "Allow public update" ON public.qr_files_log
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

-- 4. Storage Bucket Setup (qr-files)
-- Instruction: Run this in Supabase SQL editor to configure policies for the 'qr-files' storage bucket.
-- Ensure the bucket exists. You can create it in the Supabase Storage UI named 'qr-files' as a Public bucket,
-- or run the following helper if you have database helper access enabled:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('qr-files', 'qr-files', true) ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects in the 'qr-files' bucket
-- Allow public uploads (insert) to 'qr-files'
CREATE POLICY "Allow public storage upload" ON storage.objects
    FOR INSERT TO anon
    WITH CHECK (bucket_id = 'qr-files');

-- Allow public reading (select) of files from 'qr-files'
CREATE POLICY "Allow public storage select" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'qr-files');

-- Allow public removal (delete) of files (for admin cleanups)
CREATE POLICY "Allow public storage delete" ON storage.objects
    FOR DELETE TO anon
    USING (bucket_id = 'qr-files');
