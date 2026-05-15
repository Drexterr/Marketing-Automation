'use client';

import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { MessageSquare } from 'lucide-react';

export default function InboxPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <MessageSquare className="text-primary" size={32} />
          Unified Inbox
        </h1>
        <p className="text-muted-foreground mt-1 font-medium">Review and approve outgoing messages.</p>
      </div>

      <div className="w-full">
        <ReviewQueue />
      </div>
    </div>
  );
}
