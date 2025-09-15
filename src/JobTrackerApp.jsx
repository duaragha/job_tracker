import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";
import "./JobTrackerModern.css";

// JobRow component defined outside to prevent recreation on every render
const JobRow = ({ job, jobIndex, updateJobField, savingStatus, suggestions, statusOptions }) => (
    <tr>
        {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
            <td key={key}>
                {key === "status" ? (
                    <select
                        value={job[key] || ""}
                        onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                        className="form-select status-select"
                    >
                        <option value="">Select</option>
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                ) : key.includes("Date") ? (
                    <input
                        type="date"
                        value={job[key] || ""}
                        onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                        className="form-input"
                    />
                ) : (
                    <>
                        <input
                            list={`list-${key}-${jobIndex}`}
                            type="text"
                            value={job[key] || ""}
                            onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                            className="form-input"
                            placeholder={`Enter ${key}`}
                            autoComplete="off"
                        />
                        <datalist id={`list-${key}-${jobIndex}`}>
                            {(suggestions[key] || []).map((suggestion, idx) => (
                                <option key={idx} value={suggestion} />
                            ))}
                        </datalist>
                    </>
                )}
            </td>
        ))}
        <td>
            {savingStatus && (
                <span className={`save-status ${savingStatus.toLowerCase().includes('sav') ? 'saving' : savingStatus.toLowerCase().includes('error') ? 'error' : 'saved'}`}>
                    {savingStatus}
                </span>
            )}
        </td>
    </tr>
);

export default function JobTrackerApp() {
    const statusOptions = [
        "Applied",
        "Assessment",
        "Interviewing",
        "Rejected",
        "Screening",
    ];

    const [jobs, setJobs] = useState([]);
    const [filter, setFilter] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [openMonths, setOpenMonths] = useState([]);
    const [savingStatus, setSavingStatus] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });
    const saveTimeouts = useRef({});
    const searchTimeout = useRef(null);

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    useEffect(() => {
        const fetchJobs = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("jobs")
                .select("*")
                .order("appliedDate", { ascending: false });

            if (error) {
                console.error("Error fetching jobs:", error);
            } else {
                setJobs(data || []);
            }
            setIsLoading(false);
        };

        fetchJobs();
    }, []);

    const updateJobField = (jobId, jobIndex, key, value) => {
        // If rejection date is set, automatically change status to "Rejected"
        let additionalUpdates = {};
        if (key === 'rejectionDate' && value) {
            additionalUpdates.status = 'Rejected';
        }

        // Update UI immediately
        setJobs(prevJobs => {
            const updatedJobs = prevJobs.map((job, index) =>
                index === jobIndex
                    ? { ...job, [key]: value, ...additionalUpdates }
                    : job
            );

            // Clear existing timeout
            if (saveTimeouts.current[jobIndex]) {
                clearTimeout(saveTimeouts.current[jobIndex]);
            }

            // Show saving status
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saving..." }));

            // Debounce save to database
            saveTimeouts.current[jobIndex] = setTimeout(async () => {
                const jobToSave = updatedJobs[jobIndex];
                
                const sanitizedJob = {
                    ...jobToSave,
                    appliedDate: jobToSave.appliedDate === "" ? null : jobToSave.appliedDate,
                    rejectionDate: jobToSave.rejectionDate === "" ? null : jobToSave.rejectionDate,
                };

                if (jobId) {
                    const { error } = await supabase
                        .from("jobs")
                        .update(sanitizedJob)
                        .eq("id", jobId);

                    if (error) {
                        console.error("Error updating job:", error.message);
                        setSavingStatus(prev => ({ ...prev, [jobIndex]: "Error!" }));
                    } else {
                        setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saved ✅" }));
                    }
                } else {
                    const { id, ...jobWithoutId } = sanitizedJob;
                    const { data, error } = await supabase
                        .from("jobs")
                        .insert([jobWithoutId])
                        .select();

                    if (error || !data) {
                        console.error("Error inserting job:", error?.message || "No data returned");
                        setSavingStatus(prev => ({ ...prev, [jobIndex]: "Error!" }));
                    } else {
                        // Update the job with the new ID from database
                        setJobs(prevJobs => prevJobs.map((j, i) =>
                            i === jobIndex ? data[0] : j
                        ));
                        setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saved ✅" }));
                    }
                }

                // Clear status message after 2 seconds
                setTimeout(() => {
                    setSavingStatus(prev => {
                        const newStatus = { ...prev };
                        delete newStatus[jobIndex];
                        return newStatus;
                    });
                }, 2000);
            }, 800);

            return updatedJobs;
        });
    };

    const addRow = async () => {
        const today = new Date().toISOString().split('T')[0];
        const newJob = {
            company: "",
            position: "",
            location: "",
            status: "Applied", // Set default status to "Applied"
            appliedDate: today,
            rejectionDate: null,
            jobSite: "",
            url: "",
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase.from("jobs").insert([newJob]).select();

        if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
        } else {
            setJobs(prev => [data[0], ...prev]);
        }
    };

    const toggleMonth = (month) => {
        setOpenMonths(prev =>
            prev.includes(month)
                ? prev.filter(m => m !== month)
                : [...prev, month]
        );
    };

    const getMonthYear = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";
        return `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
    };

    // Filter jobs with useMemo to ensure proper re-rendering
    const filteredJobs = useMemo(() => {
        if (!filter.trim()) return jobs;

        const lowerFilter = filter.toLowerCase();
        return jobs.filter(job => {
            return (
                (job.company || "").toLowerCase().includes(lowerFilter) ||
                (job.position || "").toLowerCase().includes(lowerFilter) ||
                (job.location || "").toLowerCase().includes(lowerFilter) ||
                (job.status || "").toLowerCase().includes(lowerFilter) ||
                (job.jobSite || "").toLowerCase().includes(lowerFilter) ||
                (job.url || "").toLowerCase().includes(lowerFilter) ||
                (job.appliedDate || "").toLowerCase().includes(lowerFilter) ||
                (job.rejectionDate || "").toLowerCase().includes(lowerFilter)
            );
        });
    }, [jobs, filter]);

    // Group jobs by month
    const jobsByMonth = {};
    jobs.forEach(job => {
        const month = getMonthYear(job.appliedDate);
        if (month) {
            if (!jobsByMonth[month]) jobsByMonth[month] = [];
            jobsByMonth[month].push(job);
        }
    });

    const unsavedJobs = jobs.filter(j => !j.appliedDate);

    // Calculate stats
    const stats = {
        Applied: jobs.filter(j => j.status === "Applied").length,
        Interviewing: jobs.filter(j => j.status === "Interviewing").length,
        Rejected: jobs.filter(j => j.status === "Rejected").length,
        Assessment: jobs.filter(j => j.status === "Assessment").length,
        Screening: jobs.filter(j => j.status === "Screening").length,
        Total: jobs.length
    };

    // Generate suggestions for autocomplete
    const suggestions = {
        company: [...new Set(jobs.map(j => j.company).filter(Boolean))],
        position: [...new Set(jobs.map(j => j.position).filter(Boolean))],
        location: [...new Set(jobs.map(j => j.location).filter(Boolean))],
        jobSite: [...new Set(jobs.map(j => j.jobSite).filter(Boolean))],
        url: [...new Set(jobs.map(j => j.url).filter(Boolean))]
    };

    if (isLoading) {
        return (
            <div className="job-tracker-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading your job applications...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="job-tracker-container">
            <header className="tracker-header">
                <div className="header-content">
                    <div>
                        <h1 className="tracker-title">Job Application Tracker</h1>
                        <p className="tracker-subtitle">Track, manage, and succeed in your job search</p>
                    </div>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="dark-mode-toggle"
                        aria-label="Toggle dark mode"
                    >
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                </div>
            </header>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search jobs by any field..."
                    value={searchInput}
                    onChange={(e) => {
                        const value = e.target.value;
                        setSearchInput(value);
                        
                        // Clear existing timeout
                        if (searchTimeout.current) {
                            clearTimeout(searchTimeout.current);
                        }
                        
                        // Set new timeout for debounced search
                        searchTimeout.current = setTimeout(() => {
                            setFilter(value);
                        }, 200); // 200ms debounce delay
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setSearchInput('');
                            setFilter('');
                        }
                    }}
                    className="search-input"
                />
            </div>

            {!filter.trim() && (
                <div className="stats-container">
                    <div className="stat-card stat-applied">
                        <div className="stat-label">Applied</div>
                        <div className="stat-value">{stats.Applied}</div>
                        <div className="stat-percentage">{stats.Total > 0 ? ((stats.Applied / stats.Total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div className="stat-card stat-interviewing">
                        <div className="stat-label">Interviewing</div>
                        <div className="stat-value">{stats.Interviewing}</div>
                        <div className="stat-percentage">{stats.Total > 0 ? ((stats.Interviewing / stats.Total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div className="stat-card stat-rejected">
                        <div className="stat-label">Rejected</div>
                        <div className="stat-value">{stats.Rejected}</div>
                        <div className="stat-percentage">{stats.Total > 0 ? ((stats.Rejected / stats.Total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div className="stat-card stat-assessment">
                        <div className="stat-label">Assessment</div>
                        <div className="stat-value">{stats.Assessment}</div>
                        <div className="stat-percentage">{stats.Total > 0 ? ((stats.Assessment / stats.Total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div className="stat-card stat-screening">
                        <div className="stat-label">Screening</div>
                        <div className="stat-value">{stats.Screening}</div>
                        <div className="stat-percentage">{stats.Total > 0 ? ((stats.Screening / stats.Total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div className="stat-card stat-total">
                        <div className="stat-label">Total Jobs</div>
                        <div className="stat-value">{stats.Total}</div>
                        <div className="stat-percentage">All applications</div>
                    </div>
                </div>
            )}

            {!filter.trim() && (
                <div style={{ maxWidth: '1400px', margin: '0 auto 2rem', padding: '0 1rem' }}>
                    <button
                        onClick={addRow}
                        className="action-button"
                    >
                        <span>+</span> Add New Application
                    </button>
                </div>
            )}

            {!filter.trim() && unsavedJobs.length > 0 && (
                <div className="month-section">
                    <div className="month-header" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderBottom: '2px solid #fbbf24' }}>
                        <h2 className="month-title">Pending Applications</h2>
                        <div className="month-stats">
                            <span className="month-stat">Missing Applied Date</span>
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="jobs-table">
                            <thead>
                                <tr>
                                    {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
                                        <th key={key}>
                                            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                        </th>
                                    ))}
                                    <th style={{minWidth: "100px"}}>Save Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unsavedJobs.map((job, index) => {
                                    const jobIndex = jobs.findIndex(j => j.id === job.id);
                                    return (
                                        <JobRow
                                            key={job.id || `unsaved-${index}`}
                                            job={job}
                                            jobIndex={jobIndex}
                                            updateJobField={updateJobField}
                                            savingStatus={savingStatus[jobIndex]}
                                            suggestions={suggestions}
                                            statusOptions={statusOptions}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {filter.trim() ? (
                <div className="month-section">
                    <div className="table-container">
                        <table className="jobs-table">
                            <thead>
                                <tr>
                                    {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
                                        <th key={key}>
                                            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                        </th>
                                    ))}
                                    <th style={{minWidth: "100px"}}>Save Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredJobs.map((job) => {
                                    const jobIndex = jobs.findIndex(j => j.id === job.id);
                                    return (
                                        <JobRow
                                            key={job.id || `filtered-${jobIndex}`}
                                            job={job}
                                            jobIndex={jobIndex}
                                            updateJobField={updateJobField}
                                            savingStatus={savingStatus[jobIndex]}
                                            suggestions={suggestions}
                                            statusOptions={statusOptions}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                Object.keys(jobsByMonth).map(month => {
                    const monthJobs = jobsByMonth[month];
                    const isOpen = openMonths.includes(month);
                    const monthStats = {
                        Applied: monthJobs.filter(j => j.status === "Applied").length,
                        Interviewing: monthJobs.filter(j => j.status === "Interviewing").length,
                        Rejected: monthJobs.filter(j => j.status === "Rejected").length,
                        Assessment: monthJobs.filter(j => j.status === "Assessment").length,
                        Screening: monthJobs.filter(j => j.status === "Screening").length,
                    };

                    return (
                        <div key={month} className="month-section">
                            <div
                                className="month-header"
                                onClick={() => toggleMonth(month)}
                            >
                                <h2 className="month-title">
                                    {month} <span className={`month-toggle ${isOpen ? 'open' : ''}`}>▼</span>
                                </h2>
                                <div className="month-stats">
                                    <span className="month-stat">Applied: {monthStats.Applied}</span>
                                    <span className="month-stat">Interviewing: {monthStats.Interviewing}</span>
                                    <span className="month-stat">Rejected: {monthStats.Rejected}</span>
                                    <span className="month-stat">Assessment: {monthStats.Assessment}</span>
                                    <span className="month-stat">Screening: {monthStats.Screening}</span>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="table-container">
                                    <table className="jobs-table">
                                        <thead>
                                            <tr>
                                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
                                                    <th key={key}>
                                                        {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                                    </th>
                                                ))}
                                                <th style={{minWidth: "100px"}}>Save Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthJobs.map((job) => {
                                                const jobIndex = jobs.findIndex(j => j.id === job.id);
                                                return (
                                                    <JobRow
                                                        key={job.id || `month-${jobIndex}`}
                                                        job={job}
                                                        jobIndex={jobIndex}
                                                        updateJobField={updateJobField}
                                                        savingStatus={savingStatus[jobIndex]}
                                                        suggestions={suggestions}
                                                        statusOptions={statusOptions}
                                                    />
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}