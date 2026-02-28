import React, { useState, useEffect } from 'react';
import API from '../../api/api';

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
  }, [currentPage, filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...filters
      }).toString();

      const response = await API.get(`/admin/user-activities/?${params}`);
      const { activities: fetchedActivities, pagination } = response.data;

      setActivities(fetchedActivities);
      setTotalPages(pagination.total_pages);
      setError(null);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
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
    setCurrentPage(1); // Reset to first page when filters change
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
    <div className="as-admin-container">
      <div className="as-admin-content">
        <div className="as-card">
          {/* Header */}
          <div className="as-card-header">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">User Activity Logs</h2>
                <p className="text-sm text-gray-600 mt-1">Monitor user activities and system interactions</p>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={exportToCSV}
                  disabled={activities.length === 0}
                  className="as-btn as-btn-sm as-btn-outline-secondary"
                >
                  Export CSV
                </button>
                <span className="as-badge as-badge-secondary">
                  {activities.length} records
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="as-card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="as-label">Search</label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search users, IPs..."
                  className="as-input"
                />
              </div>
              <div>
                <label className="as-label">User ID</label>
                <input
                  type="text"
                  name="user_id"
                  value={filters.user_id}
                  onChange={handleFilterChange}
                  placeholder="User ID"
                  className="as-input"
                />
              </div>
              <div>
                <label className="as-label">Action</label>
                <select
                  name="action"
                  value={filters.action}
                  onChange={handleFilterChange}
                  className="as-select"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
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
                <label className="as-label">IP Address</label>
                <input
                  type="text"
                  name="ip_address"
                  value={filters.ip_address}
                  onChange={handleFilterChange}
                  placeholder="IP Address"
                  className="as-input"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="as-btn as-btn-secondary w-full"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Activity Table */}
          <div className="overflow-x-auto">
            <table className="as-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>IP Address</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => (
                    <tr key={activity.id} className="as-table-row">
                      <td className="as-table-cell">
                        <div className="font-medium text-gray-900" title={activity.username || 'Anonymous'}>
                          {activity.username || 'Anonymous'}
                        </div>
                        {activity.user_id && (
                          <div className="text-xs text-gray-500" title={`ID: ${activity.user_id}`}>
                            ID: {activity.user_id}
                          </div>
                        )}
                      </td>
                      <td className="as-table-cell">
                        <span className={`as-badge ${activity.action === 'login' ? 'as-badge-success' :
                            activity.action === 'logout' ? 'as-badge-info' :
                            activity.action === 'profile_update' ? 'as-badge-warning' :
                            activity.action === 'booking_create' ? 'as-badge-primary' :
                            activity.action === 'payment' ? 'as-badge-indigo' :
                            activity.action === 'admin_action' ? 'as-badge-danger' :
                            activity.action === 'file_upload' ? 'as-badge-teal' :
                            'as-badge-secondary'}`}>
                          {activity.action.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <span className="font-mono text-xs">
                          {activity.ip_address}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <span className={`as-badge ${activity.method === 'GET' ? 'as-badge-success' :
                            activity.method === 'POST' ? 'as-badge-info' :
                            activity.method === 'PUT' ? 'as-badge-warning' :
                            activity.method === 'DELETE' ? 'as-badge-danger' :
                            activity.method === 'PATCH' ? 'as-badge-purple' :
                            'as-badge-secondary'}`}>
                          {activity.method}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <div className="truncate max-w-xs" title={activity.path}>{activity.path}</div>
                      </td>
                      <td className="as-table-cell">
                        <span className={`font-mono ${getStatusColor(activity.status_code) === 'red' ? 'text-red-600' : getStatusColor(activity.status_code) === 'orange' ? 'text-orange-500' : getStatusColor(activity.status_code) === 'green' ? 'text-green-600' : 'text-gray-600'}`}>
                          {activity.status_code}
                        </span>
                      </td>
                      <td className="as-table-cell">
                        <div className="text-xs">
                          {new Date(activity.timestamp).toLocaleDateString()}<br />
                          <span className="text-gray-400">
                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="as-table-cell">
                        <button 
                          onClick={() => toggleDetails(activity.id)}
                          className="as-btn as-btn-sm as-btn-outline-primary"
                        >
                          {showDetails === activity.id ? 'Hide' : 'Show'}
                        </button>
                        {showDetails === activity.id && (
                          <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs font-mono max-h-40 overflow-auto">
                            <pre>{JSON.stringify({
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
  );
};

export default AdminActivityLogs;