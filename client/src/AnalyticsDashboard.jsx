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
            const calculatedUploads = uploads.map((currentUpload, index) => {
                let churnPercentage = null;
                if (index > 0) {
                    const previousUpload = uploads[index - 1];
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
    }, [uploads]); // Recalculate when uploads data changes

    if (error) {
        return <div style={{ color: 'red' }}>Error fetching data: {error}</div>;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' }; // removed time
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    return (
        <div>
            <h1>Patreon Analytics Dashboard</h1>
            <button style={{ marginBottom: '20px', padding: '10px 15px' }}>Import CSV</button>
            
            {processedUploads.length === 0 && !error && <p>Loading data or no uploads found...</p>}
            
            {processedUploads.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>Date</th>
                            <th style={tableHeaderStyle}>Active Patrons</th>
                            <th style={tableHeaderStyle}>Net Change</th>
                            <th style={tableHeaderStyle}>Lost Patrons</th>
                            <th style={tableHeaderStyle}>Churn %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedUploads.map((upload) => (
                            <tr key={upload.upload_id}>
                                <td style={tableCellStyle}>{formatDate(upload.upload_timestamp)}</td>
                                <td style={tableCellStyle}>{upload.active_patron_count}</td>
                                <td style={tableCellStyle}>{upload.net_patron_change}</td>
                                <td style={tableCellStyle}>{upload.lost_patron_count}</td>
                                <td style={tableCellStyle}>
                                    {upload.churn_percentage !== null 
                                        ? `${upload.churn_percentage.toFixed(2)}%` 
                                        : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {/* <pre>{JSON.stringify(processedUploads, null, 2)}</pre> */}
        </div>
    );
}

// Basic inline styles for the table (can be replaced with CSS classes later)
const tableHeaderStyle = {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2',
};

const tableCellStyle = {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left',
};

export default AnalyticsDashboard;
