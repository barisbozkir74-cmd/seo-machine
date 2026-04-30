'use server'

// STUB — Plan 16-03 placeholder. Plan 16-04 overwrites with the real implementation.
// This file exists only so RecoveryTaskTable's `import { updateRecoveryTaskStatus } from './actions'`
// compiles after Plan 16-03 lands but before Plan 16-04 lands.

export type RecoveryTaskActionResult =
  | { success: true }
  | { success: false; error: string }

export async function updateRecoveryTaskStatus(
  _taskId: string,
  _projectId: string,
  _status: 'in_progress' | 'dismissed',
): Promise<RecoveryTaskActionResult> {
  // Plan 16-04 implements this. Until then, this stub fails closed (defense-in-depth)
  // so accidentally-shipped intermediate builds cannot mutate any data.
  return {
    success: false,
    error: 'Recovery aksiyonları henüz aktif değil. (Plan 16-04 bekleniyor.)',
  }
}
