import React, { useState, useEffect } from 'react';
import API from '../../api/api';

// Force light theme for all admin pages
function AdminThemeEnforcer() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      // Restore user preference on unmount
      const saved = localStorage.getItem('theme') || 'LIGHT';
      if (saved === 'DARK') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };
  }, []);
  return null;
}

const AdminActivityLogs = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    ip_address: '',
    search: ''
  });
  const [showDetails, setShowDetails] = useState(null);

  useEffect(() => {
    fetchActivities();
  }, [currentPage]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // Build params object, only including non-empty filters
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', '20');
      
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.ip_address) params.append('ip_address', filters.ip_address);
      if (filters.search) params.append('search', filters.search);

      const url = `/admin/user-activities/?${params.toString()}`;
      const response = await API.get(url);
      const { activities: fetchedActivities, pagination } = response.data;

      setActivities(fetchedActivities);
      setTotalPages(pagination.total_pages);
      setError(null);
    } catch (err) {
      setError('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchActivities();
  };

  const handleClearFilters = () => {
    setFilters({
      user_id: '',
      action: '',
      ip_address: '',
      search: ''
    });
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (statusCode) => {
    if (statusCode >= 500) return 'red';
    if (statusCode >= 400) return 'orange';
    if (statusCode >= 200 && statusCode < 300) return 'green';
    return 'gray';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toggleDetails = (activityId) => {
    setShowDetails(showDetails === activityId ? null : activityId);
  };

  // Function to export data as CSV
  const exportToCSV = () => {
    if (activities.length === 0) return;
    
    // Create CSV content
    const headers = ['User', 'Action', 'IP Address', 'Method', 'Path', 'Status Code', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...activities.map(activity => [
        `"${activity.username || 'Anonymous'}"`,
        `"${activity.action.replace(/,/g, ' ')}"`,
        `"${activity.ip_address}"`,
        `"${activity.method}"`,
        `"${activity.path.replace(/,/g, ' ')}"`,
        activity.status_code,
        `"${activity.timestamp}"`
      ].join(','))
    ].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <AdminThemeEnforcer />
      <div className="as-admin-container" style={{ background: 'var(--background)' }}>
      <div className="as-admin-content">
        <div className="as-card" style={{ background: 'var(--surface)' }}>
          {/* Header */}
          <div className="as-card-header" style={{ background: '#0b1220', borderBottom: '2px solid #d4af37' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'white', fontWeight: '800', letterSpacing: '0.04em' }}>USER ACTIVITY LOGS</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>Monitor user activities and system interactions</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={exportToCSV}
                  disabled={activities.length === 0}
                  className="as-btn as-btn-sm" style={{ background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)', color: '#0b1220', border: 'none', fontWeight: '600' }}
                >
                  Export CSV
                </button>
                <span className="as-badge" style={{ background: '#334155', color: '#d4af37', fontWeight: '600' }}>
                  {activities.length} records
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="as-card-body">
            <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="as-label" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Search</label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search users, IPs..."
                  className="as-input"
                  style={{
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>
              <div>
                <label className="as-label" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>User ID</label>
                <input
                  type="text"
                  name="user_id"
                  value={filters.user_id}
                  onChange={handleFilterChange}
                  placeholder="User ID"
                  className="as-input"
                  style={{
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>
              <div>
                <label className="as-label" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Action</label>
                <select
                  name="action"
                  value={filters.action}
                  onChange={handleFilterChange}
                  className="as-select"
                  style={{
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="login_blocked">Login Blocked</option>
                  <option value="logout">Logout</option>
                  <option value="profile_update">Profile Update</option>
                  <option value="booking_create">Booking Create</option>
                  <option value="booking_cancel">Booking Cancel</option>
                  <option value="payment">Payment</option>
                  <option value="api_access">API Access</option>
                  <option value="admin_action">Admin Action</option>
                  <option value="file_upload">File Upload</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="as-label" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>IP Address</label>
                <input
                  type="text"
                  name="ip_address"
                  value={filters.ip_address}
                  onChange={handleFilterChange}
                  placeholder="IP Address"
                  className="as-input"
                  style={{
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="submit"
                  className="as-btn as-btn-primary"
                  style={{ fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="as-btn"
                  style={{ 
                    fontWeight: '600', 
                    flex: 1,
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fecaca'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            </form>
          </div>

          {/* Activity Table */}
          <div className="overflow-x-auto" style={{ 
            background: 'var(--surface)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: '-ms-autohiding-scrollbar'
          }}>
            <div style={{ minWidth: '1200px' }}>
            <table className="as-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#0b1220' }}>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>User</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Action</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>IP Address</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Method</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Path</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Status</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Time</th>
                  <th style={{ color: 'white', borderBottom: '2px solid var(--accent)', fontSize: '12px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                          <path d="M9 12h6"></path>
                          <path d="M9 16h6"></path>
                          <path d="M9 8h6"></path>
                        </svg>
                      </div>
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  activities.map((activity, index) => (
                    <tr key={activity.id} className="as-table-row" style={{ 
                      background: index % 2 === 0 ? 'var(--surface)' : 'var(--background)',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <td className="as-table-cell">
                        <div className="font-medium" style={{ color: 'var(--text-primary)', fontWeight: '700' }} title={activity.username || 'Anonymous'}>
                          {activity.username || 'Anonymous'}
                        </div>
                        {activity.user_id && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }} title={`ID: ${activity.user_id}`}>
                            ID: {String(activity.user_id).substring(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="as-table-cell">
                        <span style={{ 
                          display: 'inline-block',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          background: activity.action === 'api_access' ? '#fef3c7' :
                                 activity.action === 'admin_action' ? '#fee2e2' :
                                 activity.action === 'login_blocked' ? '#fee2e2' :
                                 activity.action === 'login' ? '#d1fae5' :
                                 activity.action === 'logout' ? '#e0f2fe' :
                                 activity.action === 'profile_update' ? '#fef3c7' :
                                 activity.action === 'booking_create' ? '#dbeafe' :
                                 activity.action === 'payment' ? '#e0e7ff' :
                                 activity.action === 'file_upload' ? '#ccfbf1' :
                                 '#f3f4f6',
                          color: activity.action === 'api_access' ? '#92400e' :
                                 activity.action === 'admin_action' ? '#991b1b' :
                                 activity.action === 'login_blocked' ? '#991b1b' :
                                 activity.action === 'login' ? '#065f46' :
                                 activity.action === 'logout' ? '#075985' :
                                 activity.action === 'profile_update' ? '#92400e' :
                                 activity.action === 'booking_create' ? '#1e40af' :
                                 activity.action === 'payment' ? '#3730a3' :
                                 activity.action === 'file_upload' ? '#115e59' :
                                 '#4b5563'
                        }}>
                          {activity.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'var(--text-primary)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}>
                          {activity.ip_address}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <span style={{ 
                          display: 'inline-block',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '12px',
                          background: activity.method === 'GET' ? '#d1fae5' :
                                 activity.method === 'POST' ? '#dbeafe' :
                                 activity.method === 'PUT' ? '#fef3c7' :
                                 activity.method === 'DELETE' ? '#fee2e2' :
                                 activity.method === 'PATCH' ? '#e0e7ff' :
                                 '#f3f4f6',
                          color: activity.method === 'GET' ? '#065f46' :
                                 activity.method === 'POST' ? '#1e40af' :
                                 activity.method === 'PUT' ? '#92400e' :
                                 activity.method === 'DELETE' ? '#991b1b' :
                                 activity.method === 'PATCH' ? '#3730a3' :
                                 '#4b5563'
                        }}>
                          {activity.method}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <div style={{ 
                          maxWidth: '300px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                          backgroundColor: 'rgba(139, 92, 246, 0.08)',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }} title={activity.path}>
                          {activity.path}
                        </div>
                      </td>
                      <td className="as-table-cell">
                        <span style={{ 
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          fontSize: '13px',
                          color: activity.status_code >= 500 ? '#dc2626' : 
                                 activity.status_code >= 400 ? '#ea580c' : 
                                 activity.status_code >= 200 ? '#16a34a' : '#6b7280'
                        }}>
                          {activity.status_code}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </strong>
                          <br />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="as-table-cell">
                        <button 
                          onClick={() => toggleDetails(activity.id)}
                          className="as-btn as-btn-sm"
                          style={{ 
                            background: showDetails === activity.id ? '#3b82f6' : 'transparent',
                            color: showDetails === activity.id ? 'white' : '#3b82f6',
                            border: '1px solid #3b82f6',
                            fontSize: '11px',
                            padding: '4px 10px'
                          }}
                        >
                          {showDetails === activity.id ? 'Hide' : 'Show'}
                        </button>
                        {showDetails === activity.id && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '12px', 
                            background: '#f8fafc', 
                            borderRadius: '6px', 
                            border: '1px solid #e2e8f0',
                            fontSize: '11px', 
                            fontFamily: 'monospace', 
                            maxHeight: '300px', 
                            overflow: 'auto',
                            color: '#334155'
                          }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify({
                              id: activity.id,
                              user_id: activity.user_id,
                              username: activity.username,
                              action: activity.action,
                              ip_address: activity.ip_address,
                              user_agent: activity.user_agent,
                              path: activity.path,
                              method: activity.method,
                              status_code: activity.status_code,
                              timestamp: activity.timestamp,
                              additional_data: activity.additional_data
                            }, null, 2)}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="as-pagination">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{Math.min((currentPage - 1) * 20 + 1, activities.length)}</span> to <span className="font-medium">{Math.min(currentPage * 20, activities.length)}</span> of{' '}
                <span className="font-medium">{activities.length}</span> entries
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="as-btn as-btn-sm as-btn-outline-secondary"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="as-btn as-btn-sm as-btn-outline-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default AdminActivityLogs;