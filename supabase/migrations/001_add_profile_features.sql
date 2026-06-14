-- Migration: add columns for PDF upload, show_powered_by, show_menu_button
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / DO ... END blocks.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'main_button_pdf'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN main_button_pdf text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'main_button_pdf_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN main_button_pdf_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'show_powered_by'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN show_powered_by boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'show_menu_button'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN show_menu_button boolean;
  END IF;
END $$;
