'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ApprovalHistoryList } from './ApprovalHistoryList'
import { AuditTrailList } from './AuditTrailList'
import type { ApprovalHistoryPage, AuditPage } from './actions'

type Tab = 'approvals' | 'audit'

const TAB_LABELS: Record<Tab, string> = {
  approvals: 'Onay Geçmişi',
  audit:     'Audit Trail',
}

export function OnaylarTabs({
  projectId,
  userId,
  isProjectOwner,
  initialApprovalPage,
  initialAuditPage,
  approvalEmptyNode,
  auditEmptyNode,
}: {
  projectId:           string
  userId:              string
  isProjectOwner:      boolean
  initialApprovalPage: ApprovalHistoryPage
  initialAuditPage:    AuditPage
  approvalEmptyNode?:  React.ReactNode
  auditEmptyNode?:     React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<Tab>('approvals')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 mb-6 border-b border-border">
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' && (
        <ApprovalHistoryList
          projectId={projectId}
          userId={userId}
          isProjectOwner={isProjectOwner}
          initialPage={initialApprovalPage}
          emptyNode={approvalEmptyNode}
        />
      )}

      {activeTab === 'audit' && (
        <AuditTrailList
          projectId={projectId}
          initialPage={initialAuditPage}
          emptyNode={auditEmptyNode}
        />
      )}
    </div>
  )
}
