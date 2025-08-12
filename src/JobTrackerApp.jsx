import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";

// Simple Select with Datalist for autocomplete
const AutocompleteField = memo(({
    value,
    onChange,
    suggestions = [],
    fieldKey,
    placeholder = ""
}) => {
    const listId = useMemo(() => `list-${fieldKey}`, [fieldKey]);

    return (
        <>
            <input
                list={listId}
                type="text"
                value={value || ""}
                onChange={onChange}
                className="w-full p-1 border border-gray-300 rounded"
                placeholder={placeholder}
                autoComplete="off"
            />
            <datalist id={listId}>
                {suggestions.map((suggestion, index) => (
                    <option key={`${suggestion}-${index}`} value={suggestion} />
                ))}
            </datalist>
        </>
    );
});

// Memoized JobRow component with proper comparison
const JobRow = memo(({
    job,
    originalIndex,
    statusOptions,
    onFieldChange,
    savingStatus,
    suggestions
}) => {
    const handleFieldChange = useCallback((key, value) => {
        onFieldChange(originalIndex, key, value);
    }, [originalIndex, onFieldChange]);

    return (
        <tr className="border-t">
            {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                <td className="p-2" key={key}>
                    {key === "status" ? (
                        <select
                            value={job[key]}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
                        >
                            <option value="">Select</option>
                            {statusOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    ) : key.includes("Date") ? (
                        <input
                            type="date"
                            value={job[key] || ""}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
                        />
                    ) : (
                        <AutocompleteField
                            value={job[key]}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            suggestions={suggestions[key] || []}
                            fieldKey={`${key}-${originalIndex}`}
                            placeholder={`Enter ${key}`}
                        />
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
});

// Memoized Month Section component
const MonthSection = memo(({
    month,
    jobs,
    isOpen,
    onToggle,
    statusOptions,
    onFieldChange,
    savingStatuses,
    suggestions
}) => {
    const stats = useMemo(() => ({
        Applied: jobs.filter(j => j.status === "Applied").length,
        Interviewing: jobs.filter(j => j.status === "Interviewing").length,
        Rejected: jobs.filter(j => j.status === "Rejected").length,
        Assessment: jobs.filter(j => j.status === "Assessment").length,
        Screening: jobs.filter(j => j.status === "Screening").length,
    }), [jobs]);

    return (
        <div className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
            <div
                className="bg-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b cursor-pointer"
                onClick={onToggle}
            >
                <h2 className="text-xl font-semibold text-gray-800">
                    {month} {isOpen ? "▲" : "▼"}
                </h2>
                <div className="mt-2 sm:mt-0 text-sm text-gray-600 flex flex-wrap gap-3">
                    <span>📌 Applied: {stats.Applied}</span>
                    <span>📞 Interviewing: {stats.Interviewing}</span>
                    <span>❌ Rejected: {stats.Rejected}</span>
                    <span>🧪 Assessment: {stats.Assessment}</span>
                    <span>🔍 Screening: {stats.Screening}</span>
                </div>
            </div>

            {isOpen && (
                <div className="overflow-x-auto transition-all duration-300">
                    <table className="w-full table-auto text-sm">
                        <thead className="bg-slate-50 text-gray-700">
                            <tr>
                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url", "save"].map((key) => (
                                    <th key={key} className="p-3 text-left">
                                        {key === "save" ? "" : key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <JobRow
                                    key={job.id || job.originalIndex}
                                    job={job}
                                    originalIndex={job.originalIndex}
                                    statusOptions={statusOptions}
                                    onFieldChange={onFieldChange}
                                    savingStatus={savingStatuses[job.originalIndex]}
                                    suggestions={suggestions}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

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

    // Use refs for values that don't need to trigger re-renders
    const saveTimeouts = useRef({});
    const nextIndexRef = useRef(0);
    const pendingUpdates = useRef({});

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
                // Add original index to preserve reference during filtering/sorting
                const indexedJobs = data.map((job, index) => ({
                    ...job,
                    originalIndex: index
                }));
                setJobs(indexedJobs);
                nextIndexRef.current = data.length;
            }
            setIsLoading(false);
        };

        fetchJobs();
    }, []);

    // Batch state updates with debouncing
    const updateJobField = useCallback((originalIndex, key, value) => {
        // Store pending update
        if (!pendingUpdates.current[originalIndex]) {
            pendingUpdates.current[originalIndex] = {};
        }
        pendingUpdates.current[originalIndex][key] = value;

        // Clear existing timeout for this job
        if (saveTimeouts.current[originalIndex]) {
            clearTimeout(saveTimeouts.current[originalIndex]);
        }

        // Apply update immediately to UI
        setJobs(prevJobs => prevJobs.map(job =>
            job.originalIndex === originalIndex
                ? { ...job, [key]: value }
                : job
        ));

        // Show saving status
        setSavingStatus(prev => ({ ...prev, [originalIndex]: "Saving..." }));

        // Debounce the save operation
        saveTimeouts.current[originalIndex] = setTimeout(async () => {
            const job = jobs.find(j => j.originalIndex === originalIndex);
            if (!job) return;

            const updates = pendingUpdates.current[originalIndex];
            const updatedJob = { ...job, ...updates };

            const sanitizedJob = {
                ...updatedJob,
                appliedDate: updatedJob.appliedDate === "" ? null : updatedJob.appliedDate,
                rejectionDate: updatedJob.rejectionDate === "" ? null : updatedJob.rejectionDate,
            };

            // Remove the originalIndex before saving
            const { originalIndex: _, ...jobToSave } = sanitizedJob;

            if (job.id) {
                const { error } = await supabase
                    .from("jobs")
                    .update(jobToSave)
                    .eq("id", job.id);

                if (error) {
                    console.error("Error updating job:", error.message);
                    setSavingStatus(prev => ({ ...prev, [originalIndex]: "Error!" }));
                } else {
                    setSavingStatus(prev => ({ ...prev, [originalIndex]: "Saved ✅" }));
                }
            } else {
                const { id, ...jobWithoutId } = jobToSave;
                const { data, error } = await supabase
                    .from("jobs")
                    .insert([jobWithoutId])
                    .select();

                if (error || !data) {
                    console.error("Error inserting job:", error?.message || "No data returned");
                    setSavingStatus(prev => ({ ...prev, [originalIndex]: "Error!" }));
                } else {
                    // Update the job with the new ID from database
                    setJobs(prevJobs => prevJobs.map(j =>
                        j.originalIndex === originalIndex
                            ? { ...data[0], originalIndex }
                            : j
                    ));
                    setSavingStatus(prev => ({ ...prev, [originalIndex]: "Saved ✅" }));
                }
            }

            // Clear pending updates for this job
            delete pendingUpdates.current[originalIndex];

            // Clear status message after 2 seconds
            setTimeout(() => {
                setSavingStatus(prev => {
                    const newStatus = { ...prev };
                    delete newStatus[originalIndex];
                    return newStatus;
                });
            }, 2000);
        }, 1500);
    }, [jobs]);

    const addRow = useCallback(async () => {
        const newIndex = nextIndexRef.current++;
        const tempJob = {
            company: "",
            position: "",
            location: "",
            status: "",
            appliedDate: null,
            rejectionDate: null,
            jobSite: "",
            url: "",
            originalIndex: newIndex,
            id: null
        };

        // Add to UI immediately
        setJobs(prev => [tempJob, ...prev]);

        // Create in database
        const newJob = {
            company: "",
            position: "",
            location: "",
            status: "",
            appliedDate: null,
            rejectionDate: null,
            jobSite: "",
            url: "",
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase.from("jobs").insert([newJob]).select();

        if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
            // Remove the temp job if insert failed
            setJobs(prev => prev.filter(j => j.originalIndex !== newIndex));
        } else {
            // Update with real ID
            setJobs(prev => prev.map(j =>
                j.originalIndex === newIndex
                    ? { ...data[0], originalIndex: newIndex }
                    : j
            ));
        }
    }, []);

    const toggleMonth = useCallback((month) => {
        setOpenMonths(prev =>
            prev.includes(month)
                ? prev.filter(m => m !== month)
                : [...prev, month]
        );
    }, []);

    const getMonthYear = useCallback((dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";
        return `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
    }, []);

    // Memoized computed values
    const filteredJobs = useMemo(() => {
        if (!filter.trim()) return jobs;
        const lowerFilter = filter.toLowerCase();
        return jobs.filter(job =>
            (job.company || "").toLowerCase().includes(lowerFilter) ||
            (job.position || "").toLowerCase().includes(lowerFilter) ||
            (job.location || "").toLowerCase().includes(lowerFilter) ||
            (job.status || "").toLowerCase().includes(lowerFilter) ||
            (job.jobSite || "").toLowerCase().includes(lowerFilter) ||
            (job.url || "").toLowerCase().includes(lowerFilter) ||
            (job.appliedDate || "").toLowerCase().includes(lowerFilter) ||
            (job.rejectionDate || "").toLowerCase().includes(lowerFilter)
        );
    }, [jobs, filter]);

    const jobsByMonth = useMemo(() => {
        const grouped = {};
        jobs.forEach(job => {
            const month = getMonthYear(job.appliedDate);
            if (month) {
                if (!grouped[month]) grouped[month] = [];
                grouped[month].push(job);
            }
        });
        return grouped;
    }, [jobs, getMonthYear]);

    const uniqueMonths = useMemo(() => Object.keys(jobsByMonth), [jobsByMonth]);

    const unsavedJobs = useMemo(() =>
        jobs.filter(j => !j.appliedDate),
        [jobs]
    );

    const stats = useMemo(() => ({
        Applied: jobs.filter(j => j.status === "Applied").length,
        Interviewing: jobs.filter(j => j.status === "Interviewing").length,
        Rejected: jobs.filter(j => j.status === "Rejected").length,
        Assessment: jobs.filter(j => j.status === "Assessment").length,
        Screening: jobs.filter(j => j.status === "Screening").length,
        Total: jobs.length
    }), [jobs]);

    // Generate suggestions for autocomplete - only update when jobs change substantially
    const suggestions = useMemo(() => {
        const sugg = {
            company: new Set(),
            position: new Set(),
            location: new Set(),
            jobSite: new Set(),
            url: new Set()
        };

        jobs.forEach(job => {
            if (job.company?.trim()) sugg.company.add(job.company);
            if (job.position?.trim()) sugg.position.add(job.position);
            if (job.location?.trim()) sugg.location.add(job.location);
            if (job.jobSite?.trim()) sugg.jobSite.add(job.jobSite);
            if (job.url?.trim()) sugg.url.add(job.url);
        });

        // Convert Sets to Arrays
        return {
            company: Array.from(sugg.company),
            position: Array.from(sugg.position),
            location: Array.from(sugg.location),
            jobSite: Array.from(sugg.jobSite),
            url: Array.from(sugg.url)
        };
    }, [jobs]);

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
                                    {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                                        <th key={key} className="p-3 text-left">
                                            {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {unsavedJobs.map((job) => (
                                    <JobRow
                                        key={job.id || job.originalIndex}
                                        job={job}
                                        originalIndex={job.originalIndex}
                                        statusOptions={statusOptions}
                                        onFieldChange={updateJobField}
                                        savingStatus={savingStatus[job.originalIndex]}
                                        suggestions={suggestions}
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
                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                                    <th key={key} className="p-3 text-left">
                                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map((job) => (
                                <JobRow
                                    key={job.id || job.originalIndex}
                                    job={job}
                                    originalIndex={job.originalIndex}
                                    statusOptions={statusOptions}
                                    onFieldChange={updateJobField}
                                    savingStatus={savingStatus[job.originalIndex]}
                                    suggestions={suggestions}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                uniqueMonths.map((month) => (
                    <MonthSection
                        key={month}
                        month={month}
                        jobs={jobsByMonth[month]}
                        isOpen={openMonths.includes(month)}
                        onToggle={() => toggleMonth(month)}
                        statusOptions={statusOptions}
                        onFieldChange={updateJobField}
                        savingStatuses={savingStatus}
                        suggestions={suggestions}
                    />
                ))
            )}
        </div>
    );
}