import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// JobRow component defined outside to prevent recreation on every render
const JobRow = ({ job, jobIndex, updateJobField, savingStatus, suggestions, statusOptions }) => (
    <tr className="border-t">
        {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
            <td className="p-2" key={key}>
                {key === "status" ? (
                    <select
                        value={job[key] || ""}
                        onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                        className="w-full p-1 border border-gray-300 rounded"
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
                        className="w-full p-1 border border-gray-300 rounded"
                    />
                ) : (
                    <>
                        <input
                            list={`list-${key}-${jobIndex}`}
                            type="text"
                            value={job[key] || ""}
                            onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
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
        <td className="p-2">
            {savingStatus && (
                <div className="text-xs text-gray-500 mt-1">{savingStatus}</div>
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
    const [openMonths, setOpenMonths] = useState([]);
    const [savingStatus, setSavingStatus] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const saveTimeouts = useRef({});

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
            status: "",
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

    // Filter jobs
    const filteredJobs = filter.trim() 
        ? jobs.filter(job => {
            const lowerFilter = filter.toLowerCase();
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
        })
        : jobs;

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
            <div className="min-h-screen bg-gradient-to-tr from-slate-100 to-slate-200 p-6 flex items-center justify-center">
                <div className="text-xl text-gray-600">Loading jobs...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-100 to-slate-200 p-6">
            <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">📋 Job Application Tracker</h1>

            <div className="max-w-6xl mx-auto mb-6">
                <input
                    type="text"
                    placeholder="🔍 Search jobs by any field (company, position, location, status, job site, URL, dates)..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setFilter('');
                        }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
            </div>

            {!filter.trim() && (
                <div className="max-w-6xl mx-auto mb-6 text-sm text-gray-700 flex flex-wrap gap-4 bg-white shadow-sm rounded-lg p-4">
                    <span>📌 Applied: {stats.Applied} ({stats.Total > 0 ? ((stats.Applied / stats.Total) * 100).toFixed(1) : 0}%)</span>
                    <span>📞 Interviewing: {stats.Interviewing} ({stats.Total > 0 ? ((stats.Interviewing / stats.Total) * 100).toFixed(1) : 0}%)</span>
                    <span>❌ Rejected: {stats.Rejected} ({stats.Total > 0 ? ((stats.Rejected / stats.Total) * 100).toFixed(1) : 0}%)</span>
                    <span>🧪 Assessment: {stats.Assessment} ({stats.Total > 0 ? ((stats.Assessment / stats.Total) * 100).toFixed(1) : 0}%)</span>
                    <span>🔍 Screening: {stats.Screening} ({stats.Total > 0 ? ((stats.Screening / stats.Total) * 100).toFixed(1) : 0}%)</span>
                    <span>🗂️ Total: {stats.Total}</span>
                </div>
            )}

            {!filter.trim() && (
                <div className="max-w-6xl mx-auto mb-8">
                    <button
                        onClick={addRow}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
                    >
                        ➕ Add Row
                    </button>
                </div>
            )}

            {!filter.trim() && unsavedJobs.length > 0 && (
                <div className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
                    <div className="bg-yellow-100 p-4 border-b text-gray-800 font-semibold">
                        📌 Unsaved Jobs (No Applied Date)
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto text-sm">
                            <thead className="bg-slate-50 text-gray-700">
                                <tr>
                                    {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
                                        <th key={key} className="p-3 text-left">
                                            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {unsavedJobs.map((job, index) => (
                                    <JobRow 
                                        key={job.id || `unsaved-${index}`} 
                                        job={job} 
                                        jobIndex={jobs.indexOf(job)}
                                        updateJobField={updateJobField}
                                        savingStatus={savingStatus[jobs.indexOf(job)]}
                                        suggestions={suggestions}
                                        statusOptions={statusOptions}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {filter.trim() ? (
                <div className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
                    <table className="w-full table-auto text-sm">
                        <thead className="bg-slate-50 text-gray-700">
                            <tr>
                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
                                    <th key={key} className="p-3 text-left">
                                        {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map((job) => {
                                const jobIndex = jobs.indexOf(job);
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
                        <div key={month} className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
                            <div
                                className="bg-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b cursor-pointer"
                                onClick={() => toggleMonth(month)}
                            >
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {month} {isOpen ? "▲" : "▼"}
                                </h2>
                                <div className="mt-2 sm:mt-0 text-sm text-gray-600 flex flex-wrap gap-3">
                                    <span>📌 Applied: {monthStats.Applied}</span>
                                    <span>📞 Interviewing: {monthStats.Interviewing}</span>
                                    <span>❌ Rejected: {monthStats.Rejected}</span>
                                    <span>🧪 Assessment: {monthStats.Assessment}</span>
                                    <span>🔍 Screening: {monthStats.Screening}</span>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto text-sm">
                                        <thead className="bg-slate-50 text-gray-700">
                                            <tr>
                                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url", "save"].map(key => (
                                                    <th key={key} className="p-3 text-left">
                                                        {key === "save" ? "" : key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthJobs.map((job) => {
                                                const jobIndex = jobs.indexOf(job);
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