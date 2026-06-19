export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  strepen?: number
}

export interface Task {
  id: string
  name: string
}

export interface TaskMember {
  task_id: string
  user_id: string
  order: number
}

export interface ScheduleEntry {
  id: string
  user_id: string
  task_id: string
  week: string
  status: 'pending' | 'done'
}

export interface SwapRequest {
  id: string
  requester_id: string
  target_id: string
  entry_id: string
  status: 'pending' | 'accepted' | 'declined'
}

export interface PushSubscription {
  id: string
  user_id: string
  subscription: PushSubscriptionJSON
}

// Joined types for UI
export interface WeekTask {
  entry: ScheduleEntry
  task: Task
  assignedUser: User
  isMe: boolean
  pendingSwapRequest?: SwapRequest
}
