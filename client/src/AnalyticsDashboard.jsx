import React, { useState, useEffect } from 'react';

function AnalyticsDashboard() {
    const [uploads, setUploads] = useState([]);
    const [processedUploads, setProcessedUploads] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch('http://localhost:3001/api/uploads-summary');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setUploads(data);
            } catch (e) {
                console.error("Failed to fetch uploads summary:", e);
                setError(e.message);
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (uploads.length > 0) {
            // Sort uploads by timestamp in ascending order (oldest first)
            const sortedUploads = [...uploads].sort((a, b) => new Date(a.upload_timestamp) - new Date(b.upload_timestamp));

            const calculatedUploads = sortedUploads.map((currentUpload, index) => {
                let churnPercentage = null;
                if (index > 0) { // Ensure there's a previous upload
                    const previousUpload = sortedUploads[index - 1];
                    if (previousUpload.active_patron_count > 0) {
                        churnPercentage = (currentUpload.lost_patron_count / previousUpload.active_patron_count) * 100;
                    }
                }
                return {
                    ...currentUpload,
                    churn_percentage: churnPercentage,
                };
            });
            setProcessedUploads(calculatedUploads);
        }
    }, [uploads]);

    if (error) {
        return <div className="p-4 text-red-600">Error fetching data: {error}</div>;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Patreon Analytics Dashboard</h1>
            <button 
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-6"
            >
                Import CSV
            </button>
            
            {processedUploads.length === 0 && !error && <p className="text-gray-500">Loading data or no uploads found...</p>}
            
            {processedUploads.length > 0 && (
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">Active Patrons</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">Net Change</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">Lost Patrons</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Churn %</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {processedUploads.map((upload) => (
                                <tr key={upload.upload_id} className="hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-300">{formatDate(upload.upload_timestamp)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-300">{upload.active_patron_count}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-300">{upload.net_patron_change}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-300">{upload.lost_patron_count}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {upload.churn_percentage !== null 
                                            ? `${upload.churn_percentage.toFixed(2)}%` 
                                            : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default AnalyticsDashboard;
