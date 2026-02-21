import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`
}

export const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000/accounts'
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'secret'
