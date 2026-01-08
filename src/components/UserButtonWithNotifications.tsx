/**
 * UserButtonWithNotifications - Standard UserButton wrapper
 * 
 * Notification management moved to Groups settings page.
 */

import { UserButton } from '@clerk/clerk-react';

export function UserButtonWithNotifications() {
  return <UserButton afterSignOutUrl="/" />;
}
