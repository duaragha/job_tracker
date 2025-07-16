// Main entry file: JobTrackerApp.jsx
import React, { useState, useEffect } from "react"
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

    useEffect(() => {
        const fetchJobs = async () => {
            const { data, error } = await supabase
                .from("jobs")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching jobs:", error);
            } else {
                setJobs(data);
            }
        };

        fetchJobs();
    }, []);


    const handleChange = (index, key, value) => {
        const newJobs = [...jobs];
        newJobs[index][key] = value;
        setJobs(newJobs);
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
            created_at: new Date().toISOString(), // optional
        };

        const { data, error } = await supabase.from("jobs").insert([newJob]).select();

        if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
            alert("Failed to add job. Check console for details.");
            return;
        }

        setJobs((prev) => [data[0], ...prev]); // safe now
    };

    const saveJobToDB = async (index) => {
        const job = jobs[index];

        if (job.id) {
            // Update existing row
            const { error } = await supabase
                .from("jobs")
                .update(job)
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
                .insert([job])
                .select();

            if (error || !data) {
                console.error("Error inserting job:", error?.message || "No data returned");
                alert("Failed to save job.");
            } else {
                const updatedJobs = [...jobs];
                updatedJobs[index] = data[0]; // Replace the inserted row with the one returned (with ID)
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
            if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
            if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
            return 0;
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
    const interviewingCount = jobs.filter(
        (job) => job.status === "Interviewing"
    ).length;
    const rejectedCount = jobs.filter((job) => job.status === "Rejected").length;

    const monthTotal = jobsForMonth.length;
    const monthApplied = jobsForMonth.filter(
        (job) => job.status === "Applied"
    ).length;
    const monthInterview = jobsForMonth.filter(
        (job) => job.status === "Interviewing"
    ).length;
    const monthRejected = jobsForMonth.filter(
        (job) => job.status === "Rejected"
    ).length;

    const percent = (count, total = totalApplications) =>
        total ? ((count / total) * 100).toFixed(1) : "0.0";

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-100 to-slate-200 p-6">
            <h1 className="text-3xl font-extrabold text-center text-gray-800 mb-6 tracking-tight">
                📋 Job Application Tracker
            </h1>

            <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-4 gap-6 text-center">
                <div className="bg-white shadow-lg rounded-xl p-4">
                    <p className="text-xs text-gray-500">Total Applications</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {totalApplications}
                    </p>
                </div>
                <div className="bg-blue-50 shadow-lg rounded-xl p-4">
                    <p className="text-xs text-blue-600 font-medium">Applied</p>
                    <p className="text-xl font-semibold">
                        {appliedCount} ({percent(appliedCount)}%)
                    </p>
                </div>
                <div className="bg-yellow-50 shadow-lg rounded-xl p-4">
                    <p className="text-xs text-yellow-600 font-medium">Interviewing</p>
                    <p className="text-xl font-semibold">
                        {interviewingCount} ({percent(interviewingCount)}%)
                    </p>
                </div>
                <div className="bg-red-50 shadow-lg rounded-xl p-4">
                    <p className="text-xs text-red-600 font-medium">Rejected</p>
                    <p className="text-xl font-semibold">
                        {rejectedCount} ({percent(rejectedCount)}%)
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Filter by Month
                </label>
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-indigo-300"
                >
                    <option value="">All Months</option>
                    {uniqueMonths.map((month) => (
                        <option key={month} value={month}>
                            {month}
                        </option>
                    ))}
                </select>
            </div>

            {selectedMonth && (
                <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-4 gap-6 text-center">
                    <div className="bg-white shadow-lg rounded-xl p-4">
                        <p className="text-sm text-gray-500 font-medium">{selectedMonth}</p>
                        <p className="text-lg font-bold text-gray-800">
                            {monthTotal} Applications
                        </p>
                    </div>
                    <div className="bg-blue-50 shadow-lg rounded-xl p-4">
                        <p className="text-xs text-blue-600 font-medium">Applied</p>
                        <p className="text-lg font-semibold">
                            {monthApplied} ({percent(monthApplied, monthTotal)}%)
                        </p>
                    </div>
                    <div className="bg-yellow-50 shadow-lg rounded-xl p-4">
                        <p className="text-xs text-yellow-600 font-medium">Interviewing</p>
                        <p className="text-lg font-semibold">
                            {monthInterview} ({percent(monthInterview, monthTotal)}%)
                        </p>
                    </div>
                    <div className="bg-red-50 shadow-lg rounded-xl p-4">
                        <p className="text-xs text-red-600 font-medium">Rejected</p>
                        <p className="text-lg font-semibold">
                            {monthRejected} ({percent(monthRejected, monthTotal)}%)
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto mb-6">
                <input
                    type="text"
                    placeholder="🔍 Search jobs by company, position or status..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
            </div>

            <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm">
                        <thead className="bg-slate-100 text-gray-700">
                            <tr>
                                {[
                                    "company",
                                    "position",
                                    "location",
                                    "status",
                                    "appliedDate",
                                    "rejectionDate",
                                    "jobSite",
                                    "url",
                                ].map((key) => (
                                    <th
                                        key={key}
                                        onClick={() => handleSort(key)}
                                        className="p-3 cursor-pointer text-left hover:text-indigo-600"
                                    >
                                        {key
                                            .replace(/([A-Z])/g, " $1")
                                            .replace(/^./, (s) => s.toUpperCase())}
                                        {sortKey === key && (sortDirection === "asc" ? " ↑" : " ↓")}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map((job, index) => (
                                <tr
                                    key={index}
                                    className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                >
                                    {[
                                        "company",
                                        "position",
                                        "location",
                                        "status",
                                        "appliedDate",
                                        "rejectionDate",
                                        "jobSite",
                                        "url",
                                    ].map((key) => (
                                        <td className="p-2" key={key}>
                                            {key === "status" ? (
                                                <select
                                                    value={job[key]}
                                                    onChange={(e) =>
                                                        handleChange(index, key, e.target.value)
                                                    }
                                                    className="w-full p-1 border border-gray-300 rounded"
                                                >
                                                    <option value="">Select</option>
                                                    {statusOptions.map((status) => (
                                                        <option key={status} value={status}>
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : key.includes("Date") ? (
                                                <input
                                                    type="date"
                                                    value={job[key]}
                                                    onChange={(e) =>
                                                        handleChange(index, key, e.target.value)
                                                    }
                                                    className="w-full p-1 border border-gray-300 rounded"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={job[key]}
                                                    onChange={(e) =>
                                                        handleChange(index, key, e.target.value)
                                                    }
                                                    className="w-full p-1 border border-gray-300 rounded"
                                                />
                                            )}
                                        </td>
                                    ))}
                                    {/* ✅ Save button cell */}
                                    <td className="p-2">
                                        <button
                                            onClick={() => saveJobToDB(index)}
                                            className="bg-green-600 text-white px-2.5 py-0.5 text-sm rounded hover:bg-green-700"
                                        >
                                            Save
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-center mt-6 mb-6">
                    <button
                        onClick={addRow}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-full font-medium hover:bg-indigo-700 transition"
                    >
                        ➕ Add Row
                    </button>
                </div>
            </div>
        </div>
    );
}
