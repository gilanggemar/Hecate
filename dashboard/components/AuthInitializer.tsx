'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks'

export function AuthInitializer({ children }: { children: React.ReactNode }) {
    const initialize = useAuthStore((s) => s.initialize)

    useEffect(() => {
        initialize()
    }, [initialize])

    // Subscribe to Supabase Realtime — pushes INSERT/UPDATE/DELETE on `tasks`
    // into useTaskStore and usePMStore so agent changes appear instantly.
    useRealtimeTasks()

    return <>{children}</>
}
