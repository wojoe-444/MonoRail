import type { ReactNode } from 'react'
const I = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
)
export const FolderIcon = () => <I><path d="M1.75 3.5h4l1.5 1.75h7v7.5h-12.5z" fill="currentColor" fillOpacity=".25" /></I>
export const FileIcon = () => <I><path d="M3.5 1.75h6l3 3v9.5h-9z" /><path d="M9.5 1.75v3h3" /></I>
export const SubmoduleIcon = () => <I><path d="M1.75 3.5h4l1.5 1.75h7v7.5h-12.5z" /><path d="M6 9h4" /></I>
export const BranchIcon = () => <I><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5.5" r="1.5" /><path d="M4.5 5v6M11.5 7c0 3-7 2-7 4" /></I>
export const TagIcon = () => <I><path d="M1.75 2.75v5l6.5 6.5 5-5-6.5-6.5z" /><circle cx="5" cy="5.5" r=".8" fill="currentColor" /></I>
export const CommitIcon = () => <I><circle cx="8" cy="8" r="2.5" /><path d="M1 8h4.5M10.5 8H15" /></I>
export const CodeIcon = () => <I><path d="M5 4L1.5 8L5 12M11 4l3.5 4L11 12" /></I>
export const HistoryIcon = () => <I><path d="M2 8a6 6 0 1 0 2-4.5M2 2v3h3M8 4.5V8l2.5 1.5" /></I>
export const CopyIcon = () => <I><rect x="5.5" y="5.5" width="8" height="8" rx="1.2" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></I>
export const RepoIcon = () => <I><path d="M3 2.5h9.5v11H4.5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M3 12a1.5 1.5 0 0 1 1.5-1.5h8" /></I>
export const CompareIcon = () => <I><circle cx="4" cy="3.5" r="1.5" /><circle cx="12" cy="12.5" r="1.5" /><path d="M4 5v7.5h3.5M12 11V6.5H8.5M10 8.5l-2-2 2-2" /></I>
export const ChevronDown = () => <I size={12}><path d="M3 5.5l5 5 5-5" /></I>
export const BackupIcon = () => <I><path d="M2.5 4.5h11v8.5h-11z" /><path d="M1.75 2.5h12.5v2H1.75zM6 7.5h4" /></I>
export const IssueOpenIcon = () => <I><circle cx="8" cy="8" r="6.25" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /></I>
export const IssueClosedIcon = () => <I><circle cx="8" cy="8" r="6.25" /><path d="M5.5 8.2l1.8 1.8 3.2-3.6" /></I>
export const CommentIcon = () => <I><path d="M2 3h12v8H7l-3 2.5V11H2z" /></I>
