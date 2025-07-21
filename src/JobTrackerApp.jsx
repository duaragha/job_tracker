import React, { useState, useEffect, useRef, memo } from "react";
import { supabase } from "./supabaseClient";

export default function JobTrackerApp() {
    const statusOptions = [
        "Applied",
        "Assessment",
        "Interviewing",
        "Rejected",
        "Screening",
    ];

    const [jobs, setJobs] = useState([
        {
            id: undefined,
            company: "",
            position: "",
            location: "",
            status: "",
            appliedDate: "",
            rejectionDate: "",
            jobSite: "",
            url: "",
        },
    ]);
    const [filter, setFilter] = useState("");
    const [sortKey, setSortKey] = useState("");
    const [sortDirection, setSortDirection] = useState("asc");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [openMonths, setOpenMonths] = useState([]);
    const saveTimeouts = useRef({});
    const [savingStatus, setSavingStatus] = useState({});



    useEffect(() => {
        const fetchJobs = async () => {
            const { data, error } = await supabase
                .from("jobs")
                .select("*")
                .order("appliedDate", { ascending: false }); // newest first

            if (error) {
                console.error("Error fetching jobs:", error);
            } else {
                setJobs(data);
                setSortKey("appliedDate");
                setSortDirection("desc");
            }
        };

        fetchJobs();
    }, []);

    const handleChange = (index, key, value) => {
        const newJobs = [...jobs];
        newJobs[index][key] = value;
        setJobs(newJobs);

        setSavingStatus((prev) => ({ ...prev, [index]: "Saving..." }));

        if (saveTimeouts.current[index]) {
            clearTimeout(saveTimeouts.current[index]);
        }

        saveTimeouts.current[index] = setTimeout(async () => {
            await saveJobToDB(index);
            setSavingStatus((prev) => ({ ...prev, [index]: "Saved ✅" }));

            // Clear message after 2 seconds
            setTimeout(() => {
                setSavingStatus((prev) => {
                    const newStatus = { ...prev };
                    delete newStatus[index];
                    return newStatus;
                });
            }, 2000);
        }, 1500);
    };


    const addRow = async () => {
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
            alert("Failed to add job. Check console for details.");
            return;
        }

        setJobs((prev) => [data[0], ...prev]);
    };

    const removeId = (job) => {
        const { id, ...rest } = job;
        return rest;
    };

    const saveJobToDB = async (index) => {
        const job = jobs[index];
        const sanitizedJob = {
            ...job,
            appliedDate: job.appliedDate === "" ? null : job.appliedDate,
            rejectionDate: job.rejectionDate === "" ? null : job.rejectionDate,
        };

        if (job.id) {
            // Update existing row
            const { error } = await supabase
                .from("jobs")
                .update(sanitizedJob)
                .eq("id", job.id);

            if (error) {
                console.error("Error updating job:", error.message);
                alert("Failed to update job.");
            } else {
                console.log("Job updated");
            }
        } else {
            // Insert new row
            const { data, error } = await supabase
                .from("jobs")
                .insert([removeId(sanitizedJob)])
                .select();

            if (error || !data) {
                console.error("Error inserting job:", error?.message || "No data returned");
                alert("Failed to save job.");
            } else {
                const updatedJobs = [...jobs];
                updatedJobs[index] = data[0];
                setJobs(updatedJobs);
                console.log("Job inserted");
            }
        }
    };

    const handleSort = (key) => {
        const direction =
            sortKey === key && sortDirection === "asc" ? "desc" : "asc";
        setSortKey(key);
        setSortDirection(direction);

        const sortedJobs = [...jobs].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];

            if (key.toLowerCase().includes("date")) {
                // Convert to timestamps for date sorting
                const dateA = valA ? new Date(valA).getTime() : 0;
                const dateB = valB ? new Date(valB).getTime() : 0;
                return direction === "asc" ? dateA - dateB : dateB - dateA;
            } else {
                // Fallback for text
                return direction === "asc"
                    ? (valA || "").toString().localeCompare((valB || "").toString())
                    : (valB || "").toString().localeCompare((valA || "").toString());
            }
        });

        setJobs(sortedJobs);
    };

    const filteredJobs = jobs.filter(
        (job) =>
            job.company.toLowerCase().includes(filter.toLowerCase()) ||
            job.position.toLowerCase().includes(filter.toLowerCase()) ||
            job.status.toLowerCase().includes(filter.toLowerCase())
    );

    const getMonthYear = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return `${date.toLocaleString("default", {
            month: "long",
        })} ${date.getFullYear()}`;
    };

    const uniqueMonths = Array.from(
        new Set(
            jobs
                .map((job) => getMonthYear(job.appliedDate))
                .filter((val) => val && val !== "Invalid Date")
        )
    );

    const jobsForMonth = selectedMonth
        ? jobs.filter((job) => getMonthYear(job.appliedDate) === selectedMonth)
        : jobs;

    const totalApplications = jobs.length;
    const appliedCount = jobs.filter((job) => job.status === "Applied").length;
    const interviewingCount = jobs.filter((job) => job.status === "Interviewing").length;
    const rejectedCount = jobs.filter((job) => job.status === "Rejected").length;
    const assessmentCount = jobs.filter((job) => job.status === "Assessment").length;
    const screeningCount = jobs.filter((job) => job.status === "Screening").length;

    const percent = (count, total = totalApplications) =>
        total ? ((count / total) * 100).toFixed(1) : "0.0";

    const appliedPct = percent(appliedCount);
    const interviewingPct = percent(interviewingCount);
    const rejectedPct = percent(rejectedCount);
    const assessmentPct = percent(assessmentCount);
    const screeningPct = percent(screeningCount);

    const toggleMonth = (month) => {
        setOpenMonths((prev) =>
            prev.includes(month)
                ? prev.filter((m) => m !== month)
                : [...prev, month]
        );
    };

    const JobRow = memo(({ job, index, statusOptions, handleChange, savingStatus }) => {
        return (
            <tr key={job.id || index} className="border-t">
                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                    <td className="p-2" key={key}>
                        {key === "status" ? (
                            <select
                                value={job[key]}
                                onChange={(e) => handleChange(index, key, e.target.value)}
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
                                onChange={(e) => handleChange(index, key, e.target.value)}
                                className="w-full p-1 border border-gray-300 rounded"
                            />
                        ) : (
                            <input
                                type="text"
                                value={job[key]}
                                onChange={(e) => handleChange(index, key, e.target.value)}
                                className="w-full p-1 border border-gray-300 rounded"
                            />
                        )}
                    </td>
                ))}
                <td className="p-2">
                    {savingStatus[index] && (
                        <div className="text-xs text-gray-500 mt-1">{savingStatus[index]}</div>
                    )}
                </td>
            </tr>
        );
    });

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-100 to-slate-200 p-6">
            <h1 className="page-title">📋 Job Application Tracker</h1>

            <div className="max-w-6xl mx-auto mb-6">
                <input
                    type="text"
                    placeholder="🔍 Search jobs by company, position or status..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
            </div>

            {!filter.trim() && (
                <div className="max-w-6xl mx-auto mb-6 text-sm text-gray-700 flex flex-wrap gap-4 bg-white shadow-sm rounded-lg p-4">
                    <span>📌 Applied: {jobs.filter(j => j.status === "Applied").length}</span>
                    <span>📞 Interviewing: {jobs.filter(j => j.status === "Interviewing").length}</span>
                    <span>❌ Rejected: {jobs.filter(j => j.status === "Rejected").length}</span>
                    <span>🧪 Assessment: {jobs.filter(j => j.status === "Assessment").length}</span>
                    <span>🔍 Screening: {jobs.filter(j => j.status === "Screening").length}</span>
                    <span>🗂️ Total: {jobs.length}</span>
                </div>
            )}

            {!filter.trim() && (
                <div className="max-w-6xl mx-auto mb-8">
                    <button
                        onClick={() =>
                            setJobs((prev) => [
                                {
                                    id: undefined,
                                    company: "",
                                    position: "",
                                    location: "",
                                    status: "",
                                    appliedDate: "",
                                    rejectionDate: "",
                                    jobSite: "",
                                    url: "",
                                },
                                ...prev,
                            ])
                        }
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
                    >
                        ➕ Add Row
                    </button>
                </div>
            )}

            {!filter.trim() && jobs.some((j) => !j.appliedDate) && (
                <div className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
                    <div className="bg-yellow-100 p-4 border-b text-gray-800 font-semibold">
                        📌 Unsaved Jobs (No Applied Date)
                    </div>
                    <div className="overflow-x-auto">
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
                                {jobs
                                    .filter((j) => !j.appliedDate)
                                    .map((job, index) => (
                                        <tr key={job.id || index} className="border-t">
                                            {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                                                <td className="p-2" key={key}>
                                                    {key === "status" ? (
                                                        <select
                                                            value={job[key]}
                                                            onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
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
                                                            onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
                                                            className="w-full p-1 border border-gray-300 rounded"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={job[key]}
                                                            onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
                                                            className="w-full p-1 border border-gray-300 rounded"
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
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
                                {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url", "save"].map((key) => (
                                    <th key={key} className="p-3 text-left">
                                        {key === "save" ? "" : key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map((job, index) => (
                                <tr key={job.id || index} className="border-t">
                                    {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map((key) => (
                                        <td className="p-2" key={key}>
                                            {key === "status" ? (
                                                <select
                                                    value={job[key]}
                                                    onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
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
                                                    onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={job[key]}
                                                    onChange={(e) => handleChange(jobs.indexOf(job), key, e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded"
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td className="p-2">
                                        <button
                                            onClick={() => saveJobToDB(jobs.indexOf(job))}
                                            className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700"
                                        >
                                            💾
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                uniqueMonths.map((month) => {
                    const jobsInMonth = jobs.filter((j) => getMonthYear(j.appliedDate) === month);
                    const stats = {
                        Applied: jobsInMonth.filter(j => j.status === "Applied").length,
                        Interviewing: jobsInMonth.filter(j => j.status === "Interviewing").length,
                        Rejected: jobsInMonth.filter(j => j.status === "Rejected").length,
                        Assessment: jobsInMonth.filter(j => j.status === "Assessment").length,
                        Screening: jobsInMonth.filter(j => j.status === "Screening").length,
                    };

                    return (
                        <div key={month} className="max-w-6xl mx-auto mb-10 bg-white shadow-lg rounded-xl overflow-hidden">
                            <div
                                className="bg-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b cursor-pointer"
                                onClick={() => toggleMonth(month)}
                            >
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {month} {openMonths.includes(month) ? "▲" : "▼"}
                                </h2>
                                <div className="mt-2 sm:mt-0 text-sm text-gray-600 flex flex-wrap gap-3">
                                    <span>📌 Applied: {stats.Applied}</span>
                                    <span>📞 Interviewing: {stats.Interviewing}</span>
                                    <span>❌ Rejected: {stats.Rejected}</span>
                                    <span>🧪 Assessment: {stats.Assessment}</span>
                                    <span>🔍 Screening: {stats.Screening}</span>
                                </div>
                            </div>

                            {openMonths.includes(month) && (
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
                                            {jobsInMonth.map((job) => {
                                                const index = jobs.findIndex((j) => j.id === job.id);
                                                return (
                                                    <JobRow
                                                        key={job.id || index}
                                                        job={job}
                                                        index={index}
                                                        statusOptions={statusOptions}
                                                        handleChange={handleChange}
                                                        savingStatus={savingStatus}
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
