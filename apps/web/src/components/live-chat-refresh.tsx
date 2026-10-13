'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Re-renders a group chat when someone posts or changes sharing (Supabase Realtime, filtered by RLS).
export function LiveChatRefresh({ chatId }: { chatId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-chat:${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chat_messages', filter: `chat_id=eq.${chatId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, router]);

  return null;
}
