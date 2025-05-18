import React, { useState, useEffect, useRef, useCallback } from 'react';

function AnalyticsDashboard() {
    const [uploads, setUploads] = useState([]);
    const [processedUploads, setProcessedUploads] = useState([]);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null); 
    const [uploading, setUploading] = useState(false); 
    const [uploadMessage, setUploadMessage] = useState(''); 

    const fetchUploadsSummary = useCallback(async () => {
        setError(null); 
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
    }, []);

    useEffect(() => {
        fetchUploadsSummary();
    }, [fetchUploadsSummary]);

    useEffect(() => {
        if (uploads.length > 0) {
            const sortedUploads = [...uploads].sort((a, b) => new Date(a.upload_timestamp) - new Date(b.upload_timestamp));
            const calculatedUploads = sortedUploads.map((currentUpload, index) => {
                let churnPercentage = null;
                if (index > 0) { 
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
            setProcessedUploads([...calculatedUploads].reverse());
        } else {
            setProcessedUploads([]); 
        }
    }, [uploads]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        event.target.value = null; 

        setUploading(true);
        setUploadMessage('');

        const formData = new FormData();
        formData.append('patreonCsv', file); 

        try {
            const response = await fetch('http://localhost:3001/api/upload-csv', {
                method: 'POST',
                body: formData,
            });
            const resultText = await response.text();
            let result;
            try {
                result = JSON.parse(resultText); 
            } catch (parseError) {
                console.error("Failed to parse server response as JSON:", resultText);
                throw new Error(`Server returned non-JSON response: ${response.status} - ${resultText.substring(0, 100)}`);
            }

            if (!response.ok) {
                throw new Error(result.message || `Upload failed with status: ${response.status}`);
            }
            setUploadMessage(`Success: ${result.message || 'File uploaded successfully.'}`);
            fetchUploadsSummary(); 
        } catch (err) {
            console.error("Upload error:", err);
            setUploadMessage(`Error: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    if (error && processedUploads.length === 0) { 
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
            
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".csv"
                onChange={handleFileChange}
            />
            <button 
                onClick={() => fileInputRef.current.click()}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2"
                disabled={uploading}
            >
                {uploading ? 'Uploading...' : 'Import CSV'}
            </button>
            
            {uploadMessage && (
                <p className={`my-2 text-sm ${uploadMessage.startsWith('Error:') ? 'text-red-600' : 'text-green-600'}`}>
                    {uploadMessage}
                </p>
            )}
            {error && <p className="my-2 text-sm text-red-600">Error fetching latest data: {error}</p>}

            {processedUploads.length === 0 && !error && !uploading && <p className="text-gray-500 mt-4">Loading data or no uploads found...</p>}
            
            {processedUploads.length > 0 && (
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg mt-4">
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
