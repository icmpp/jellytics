export interface SyncStatus {
  status: string;
  last_sync_at: string | null;
  items_synced: number;
  items_failed: number;
  duration_seconds: number | null;
}

export interface UserPrefs {
  sync_interval_minutes: number;
  auto_sync: boolean;
  display_items_per_page: number;
  default_date_range_days: number;
  show_completion_percentage: boolean;
  timezone: string;
  notify_sync_complete: boolean;
  notify_sync_errors: boolean;
  weekly_target_minutes: number;
  monthly_target_minutes: number;
}
