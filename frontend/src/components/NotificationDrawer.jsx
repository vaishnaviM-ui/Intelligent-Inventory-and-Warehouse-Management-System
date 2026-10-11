import React from 'react';
import { X, CheckCheck, AlertTriangle, AlertCircle, ArrowLeftRight, PackageCheck, Info } from 'lucide-react';

export default function NotificationDrawer({ isOpen, onClose, notifications, onMarkAllRead, onMarkRead }) {
  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'out_of_stock':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'transfer':
        return <ArrowLeftRight className="w-5 h-5 text-indigo-500" />;
      case 'po_received':
        return <PackageCheck className="w-5 h-5 text-emerald-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Notifications</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Inventory alerts and operational updates</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onMarkAllRead}
                title="Mark all as read"
                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-xs flex items-center gap-1 font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-navy-800/60 p-2 sm:p-4">
            {notifications.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">All caught up!</h4>
                <p className="text-xs text-slate-400 mt-1">No pending alerts or notifications at this time.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => !n.is_read && onMarkRead(n.notification_id)}
                  className={`p-3.5 rounded-xl transition-all cursor-pointer flex gap-3.5 ${
                    n.is_read 
                      ? 'opacity-70 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-navy-800/40' 
                      : 'bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-medium'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getIcon(n.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {n.title}
                      </h4>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 block">
                      {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
