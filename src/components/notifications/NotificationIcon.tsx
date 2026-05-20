// Shared icon component dùng chung cho Toast, NotificationCard, và NotificationDrawer.
// Trước đây mỗi nơi có getIcon() riêng với Tailwind class hardcoded — giờ tập trung một chỗ.
import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { NotificationType } from '@/types/notifications';

interface NotificationIconProps {
  type: NotificationType;
  size?: number;
}

const ICON_COLORS: Record<NotificationType, string> = {
  success: 'var(--positive)',
  error:   'var(--negative)',
  warning: '#f59e0b',
  info:    'var(--accent)',
};

export default function NotificationIcon({ type, size = 20 }: NotificationIconProps) {
  const color = ICON_COLORS[type] ?? 'var(--text-muted)';
  const props = { size, style: { color }, className: 'flex-shrink-0' } as const;

  switch (type) {
    case 'success': return <CheckCircle2 {...props} />;
    case 'error':   return <AlertCircle {...props} />;
    case 'warning': return <AlertTriangle {...props} />;
    default:        return <Info {...props} />;
  }
}
